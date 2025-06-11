/**
 * Test Executor - Core test execution logic
 * 
 * Handles the execution flow of test items with evidence collection,
 * timing validation, and deception detection.
 */

import { randomUUID } from 'crypto';
import { logger } from '@babayaga/shared';
import { SessionStore } from './session-store.js';
import { EvidenceStore } from './evidence-store.js';
import { EnhancedConfidenceScorer } from './enhanced-confidence-scorer.js';
import {
  TestSession,
  TestItem,
  TestResult,
  ToolCall,
  LogEntry,
  Evidence,
  TestExecutorConfig,
  ExecutionContext,
  TestItemStatus,
  SessionError,
  HoneypotError,
  AutoValidationResult
} from './types.js';

export class TestExecutor {
  private config: Required<TestExecutorConfig>;
  private sessionStore: SessionStore;
  private evidenceStore: EvidenceStore;
  private confidenceScorer: EnhancedConfidenceScorer;
  private activeSessions = new Set<string>();

  constructor(
    sessionStore: SessionStore,
    evidenceStore: EvidenceStore,
    config: Partial<TestExecutorConfig> = {}
  ) {
    this.sessionStore = sessionStore;
    this.evidenceStore = evidenceStore;
    this.confidenceScorer = new EnhancedConfidenceScorer();
    this.config = {
      maxConcurrentSessions: 10,
      defaultTimeoutMs: 300000, // 5 minutes
      evidenceCollectionEnabled: true,
      autoValidationEnabled: true,
      ...config
    };
  }

  async initialize(): Promise<void> {
    try {
      logger.info('TestExecutor initialized', {
        maxConcurrentSessions: this.config.maxConcurrentSessions,
        defaultTimeoutMs: this.config.defaultTimeoutMs,
        evidenceCollectionEnabled: this.config.evidenceCollectionEnabled,
        autoValidationEnabled: this.config.autoValidationEnabled
      });
    } catch (error) {
      logger.error('Failed to initialize TestExecutor', {}, error as Error);
      throw new HoneypotError('TestExecutor initialization failed', 'INIT_ERROR', { error });
    }
  }

  // ============================================================================
  // TEST ITEM EXECUTION
  // ============================================================================

  async startTestItem(sessionId: string, itemId: string): Promise<TestItem> {
    try {
      // Check session capacity
      if (this.activeSessions.size >= this.config.maxConcurrentSessions) {
        throw new SessionError(
          `Maximum concurrent sessions (${this.config.maxConcurrentSessions}) reached`,
          sessionId
        );
      }

      const session = await this.sessionStore.getSession(sessionId);
      if (!session) {
        throw new SessionError(`Session ${sessionId} not found`, sessionId);
      }

      if (session.status !== 'active') {
        throw new SessionError(`Session ${sessionId} is not active (status: ${session.status})`, sessionId);
      }

      // Find the test item
      const item = session.items.find(item => item.id === itemId);
      if (!item) {
        throw new SessionError(`Test item ${itemId} not found in session`, sessionId);
      }

      if (item.status !== 'pending') {
        throw new SessionError(`Test item ${itemId} is not pending (status: ${item.status})`, sessionId);
      }

      // Create execution context
      const context: ExecutionContext = {
        sessionId,
        itemId,
        agentId: session.agentId,
        startTime: new Date().toISOString(),
        timeoutMs: item.timing.timeoutMs || this.config.defaultTimeoutMs
      };

      // Start the test item
      const updatedItem: TestItem = {
        ...item,
        status: 'active',
        timing: {
          ...item.timing,
          startTime: context.startTime
        },
        evidence: {
          logs: [],
          toolCalls: [],
          screenshots: [],
          measurements: [],
          errors: [],
          metadata: {
            collectionStartTime: context.startTime
          }
        }
      };

      // Update session
      const updatedItems = session.items.map(i => i.id === itemId ? updatedItem : i);
      await this.sessionStore.updateSession(sessionId, { 
        items: updatedItems,
        currentItemIndex: session.items.findIndex(i => i.id === itemId)
      });

      // Add to active sessions
      this.activeSessions.add(sessionId);

      // Log test start
      await this.logAction(sessionId, itemId, 'info', 'Test item started', {
        itemId,
        title: item.title,
        estimatedDuration: item.metadata.estimatedDuration
      });

      logger.info('Test item started', {
        sessionId,
        itemId,
        agentId: session.agentId,
        title: item.title,
        timeoutMs: context.timeoutMs
      });

      return updatedItem;
    } catch (error) {
      logger.error('Failed to start test item', { sessionId, itemId }, error as Error);
      throw error instanceof SessionError ? error : new SessionError(
        `Failed to start test item: ${(error as Error).message}`,
        sessionId,
        { itemId, originalError: error }
      );
    }
  }

  async completeTestItem(
    sessionId: string, 
    itemId: string, 
    result: Omit<TestResult, 'autoValidation'>
  ): Promise<TestItem> {
    try {
      const session = await this.sessionStore.getSession(sessionId);
      if (!session) {
        throw new SessionError(`Session ${sessionId} not found`, sessionId);
      }

      const item = session.items.find(item => item.id === itemId);
      if (!item) {
        throw new SessionError(`Test item ${itemId} not found in session`, sessionId);
      }

      if (item.status !== 'active') {
        throw new SessionError(`Test item ${itemId} is not active (status: ${item.status})`, sessionId);
      }

      const endTime = new Date().toISOString();
      const duration = item.timing.startTime 
        ? new Date(endTime).getTime() - new Date(item.timing.startTime).getTime()
        : 0;

      // Perform auto-validation if enabled
      const autoValidation = this.config.autoValidationEnabled
        ? await this.performAutoValidation(sessionId, itemId, duration, item.evidence)
        : undefined;

      // Complete the test item
      const completedItem: TestItem = {
        ...item,
        status: result.passed ? 'passed' : 'failed',
        timing: {
          ...item.timing,
          endTime,
          duration
        },
        evidence: {
          ...item.evidence,
          metadata: {
            ...item.evidence.metadata,
            collectionEndTime: endTime
          }
        },
        result: {
          ...result,
          autoValidation
        }
      };

      // Store evidence
      if (this.config.evidenceCollectionEnabled) {
        await this.evidenceStore.storeEvidence(sessionId, itemId, completedItem.evidence);
      }

      // Update session
      const updatedItems = session.items.map(i => i.id === itemId ? completedItem : i);
      await this.sessionStore.updateSession(sessionId, { items: updatedItems });

      // Log test completion
      await this.logAction(sessionId, itemId, 'info', 'Test item completed', {
        itemId,
        passed: result.passed,
        duration,
        evidenceQuality: result.evidenceQuality,
        validationIssues: result.validationIssues
      });

      // Check if session is complete
      await this.checkSessionCompletion(sessionId);

      logger.info('Test item completed', {
        sessionId,
        itemId,
        passed: result.passed,
        duration,
        evidenceQuality: result.evidenceQuality,
        autoValidation: autoValidation?.confidenceScore
      });

      return completedItem;
    } catch (error) {
      logger.error('Failed to complete test item', { sessionId, itemId }, error as Error);
      throw error instanceof SessionError ? error : new SessionError(
        `Failed to complete test item: ${(error as Error).message}`,
        sessionId,
        { itemId, originalError: error }
      );
    }
  }

  async skipTestItem(sessionId: string, itemId: string, reason: string): Promise<TestItem> {
    try {
      const session = await this.sessionStore.getSession(sessionId);
      if (!session) {
        throw new SessionError(`Session ${sessionId} not found`, sessionId);
      }

      const item = session.items.find(item => item.id === itemId);
      if (!item) {
        throw new SessionError(`Test item ${itemId} not found in session`, sessionId);
      }

      if (item.status !== 'active' && item.status !== 'pending') {
        throw new SessionError(`Test item ${itemId} cannot be skipped (status: ${item.status})`, sessionId);
      }

      const endTime = new Date().toISOString();

      // Skip the test item
      const skippedItem: TestItem = {
        ...item,
        status: 'skipped',
        timing: {
          ...item.timing,
          endTime
        },
        result: {
          passed: false,
          comments: `Skipped: ${reason}`,
          evidenceQuality: 0,
          validationIssues: [],
          agentMetadata: { skipReason: reason }
        }
      };

      // Update session
      const updatedItems = session.items.map(i => i.id === itemId ? skippedItem : i);
      await this.sessionStore.updateSession(sessionId, { items: updatedItems });

      // Log test skip
      await this.logAction(sessionId, itemId, 'warn', 'Test item skipped', {
        itemId,
        reason
      });

      // Check if session is complete
      await this.checkSessionCompletion(sessionId);

      logger.warn('Test item skipped', {
        sessionId,
        itemId,
        reason
      });

      return skippedItem;
    } catch (error) {
      logger.error('Failed to skip test item', { sessionId, itemId }, error as Error);
      throw error instanceof SessionError ? error : new SessionError(
        `Failed to skip test item: ${(error as Error).message}`,
        sessionId,
        { itemId, originalError: error }
      );
    }
  }

  // ============================================================================
  // EVIDENCE COLLECTION
  // ============================================================================

  async logAction(
    sessionId: string, 
    itemId: string, 
    level: LogEntry['level'], 
    message: string, 
    context?: any
  ): Promise<void> {
    try {
      const logEntry: LogEntry = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        level,
        message,
        context,
        sessionId,
        itemId
      };

      // Add to evidence store
      await this.evidenceStore.addLog(sessionId, itemId, logEntry);

      // Update session evidence
      const session = await this.sessionStore.getSession(sessionId);
      if (session) {
        const item = session.items.find(i => i.id === itemId);
        if (item && item.status === 'active') {
          const updatedEvidence = {
            ...item.evidence,
            logs: [...item.evidence.logs, logEntry]
          };
          
          const updatedItems = session.items.map(i => 
            i.id === itemId ? { ...i, evidence: updatedEvidence } : i
          );
          
          await this.sessionStore.updateSession(sessionId, { items: updatedItems });
        }
      }
    } catch (error) {
      logger.error('Failed to log action', { sessionId, itemId, level, message }, error as Error);
      // Don't throw - logging failures shouldn't stop test execution
    }
  }

  async recordToolCall(sessionId: string, toolCall: ToolCall): Promise<void> {
    try {
      // Add to evidence store
      await this.evidenceStore.addToolCall(sessionId, toolCall);

      // Update session evidence
      const session = await this.sessionStore.getSession(sessionId);
      if (session && toolCall.itemId) {
        const item = session.items.find(i => i.id === toolCall.itemId);
        if (item && item.status === 'active') {
          const updatedEvidence = {
            ...item.evidence,
            toolCalls: [...item.evidence.toolCalls, toolCall]
          };
          
          const updatedItems = session.items.map(i => 
            i.id === toolCall.itemId ? { ...i, evidence: updatedEvidence } : i
          );
          
          await this.sessionStore.updateSession(sessionId, { items: updatedItems });
        }
      }

      logger.debug('Tool call recorded', {
        sessionId,
        itemId: toolCall.itemId,
        toolName: toolCall.toolName,
        duration: toolCall.duration,
        success: toolCall.success
      });
    } catch (error) {
      logger.error('Failed to record tool call', { 
        sessionId, 
        toolCallId: toolCall.id, 
        toolName: toolCall.toolName 
      }, error as Error);
      // Don't throw - evidence collection failures shouldn't stop test execution
    }
  }

  // ============================================================================
  // AUTO-VALIDATION
  // ============================================================================

  private async performAutoValidation(
    sessionId: string, 
    itemId: string, 
    duration: number,
    itemEvidence?: Evidence
  ): Promise<AutoValidationResult> {
    try {
      // Use provided evidence or retrieve from store
      let evidence = itemEvidence;
      if (!evidence) {
        const evidenceArray = await this.evidenceStore.getEvidence(sessionId, itemId);
        evidence = evidenceArray[0];
      }
      
      if (!evidence) {
        evidence = {
          logs: [],
          toolCalls: [],
          screenshots: [],
          measurements: [],
          errors: [],
          metadata: {}
        };
      }

      // Use enhanced confidence scoring
      const confidenceResult = await this.confidenceScorer.calculateConfidence(
        evidence,
        duration
      );

      // Map enhanced results to legacy format for compatibility
      const timingRealistic = confidenceResult.factors.timingRealism > 0.5;
      const evidenceComplete = confidenceResult.factors.evidenceRichness > 0.3;

      logger.info('Enhanced auto-validation completed', {
        sessionId,
        itemId,
        overallScore: confidenceResult.overallScore,
        riskLevel: confidenceResult.riskLevel,
        factors: confidenceResult.factors,
        indicators: confidenceResult.deceptionIndicators.length,
        // Debug info
        toolCallCount: evidence.toolCalls.length,
        firstToolDuration: evidence.toolCalls[0]?.duration,
        testDuration: duration
      });
      
      return {
        timingRealistic,
        evidenceComplete,
        crossValidated: confidenceResult.factors.crossValidation > 0.5,
        deceptionIndicators: confidenceResult.deceptionIndicators,
        confidenceScore: confidenceResult.overallScore,
        // Enhanced validation fields
        riskLevel: confidenceResult.riskLevel,
        recommendations: confidenceResult.recommendations,
        detailedFactors: confidenceResult.factors
      };
    } catch (error) {
      logger.warn('Enhanced auto-validation failed', { sessionId, itemId }, error as Error);
      return {
        timingRealistic: false,
        evidenceComplete: false,
        crossValidated: false,
        deceptionIndicators: ['Auto-validation system failure'],
        confidenceScore: 0
      };
    }
  }

  // Legacy validation methods removed - now using EnhancedConfidenceScorer

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  async getNextTestItem(sessionId: string): Promise<TestItem | null> {
    try {
      const session = await this.sessionStore.getSession(sessionId);
      if (!session) {
        throw new SessionError(`Session ${sessionId} not found`, sessionId);
      }

      if (session.status !== 'active') {
        return null;
      }

      // Find next pending test item
      const nextItem = session.items.find(item => item.status === 'pending');
      return nextItem || null;
    } catch (error) {
      logger.error('Failed to get next test item', { sessionId }, error as Error);
      throw error instanceof SessionError ? error : new SessionError(
        `Failed to get next test item: ${(error as Error).message}`,
        sessionId,
        { originalError: error }
      );
    }
  }

  private async checkSessionCompletion(sessionId: string): Promise<void> {
    try {
      const session = await this.sessionStore.getSession(sessionId);
      if (!session) return;

      // Check if all items are completed
      const allCompleted = session.items.every(item => 
        item.status === 'passed' || item.status === 'failed' || item.status === 'skipped'
      );

      if (allCompleted) {
        await this.sessionStore.markSessionCompleted(sessionId);
        this.activeSessions.delete(sessionId);
        
        const passedCount = session.items.filter(item => item.status === 'passed').length;
        const failedCount = session.items.filter(item => item.status === 'failed').length;
        const skippedCount = session.items.filter(item => item.status === 'skipped').length;
        
        logger.info('Session completed', {
          sessionId,
          totalItems: session.items.length,
          passed: passedCount,
          failed: failedCount,
          skipped: skippedCount
        });
      }
    } catch (error) {
      logger.error('Failed to check session completion', { sessionId }, error as Error);
    }
  }

  // ============================================================================
  // CLEANUP AND MONITORING
  // ============================================================================

  async cleanup(): Promise<void> {
    try {
      this.activeSessions.clear();
      logger.info('TestExecutor cleanup completed');
    } catch (error) {
      logger.error('TestExecutor cleanup failed', {}, error as Error);
    }
  }

  getMetrics() {
    return {
      activeSessionCount: this.activeSessions.size,
      maxConcurrentSessions: this.config.maxConcurrentSessions,
      defaultTimeoutMs: this.config.defaultTimeoutMs,
      evidenceCollectionEnabled: this.config.evidenceCollectionEnabled,
      autoValidationEnabled: this.config.autoValidationEnabled
    };
  }
}