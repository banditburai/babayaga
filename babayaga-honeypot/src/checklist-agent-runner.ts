/**
 * Checklist-Driven Agent Testing System
 * Ensures agents complete tests sequentially with verifiable evidence
 */

import { logger } from '@babayaga/shared';

export interface TestChecklistItem {
  id: string;
  title: string;
  description: string;
  testInstructions: string;
  expectedOutcome: string;
  verificationCriteria: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  evidence?: TestEvidence;
  agentComments?: string;
  timestamp?: string;
  duration?: number;
}

export interface NetworkRequest {
  timestamp: string;
  method: string;
  url: string;
  status: number;
  responseSize: number;
  duration: number;
}

export interface TestEvidence {
  logs: TestLog[];
  screenshots: string[];
  measurements: any[];
  networkRequests: NetworkRequest[];
  errorMessages: string[];
  toolCalls: ToolCall[];
}

export interface TestLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: any;
}

export interface ToolCall {
  toolName: string;
  parameters: any;
  response: any;
  timestamp: string;
  duration: number;
  success: boolean;
}

export class ChecklistAgentRunner {
  private checklist: TestChecklistItem[] = [];
  private currentItemIndex: number = 0;
  private agentId: string;
  private sessionId: string;
  private evidenceCollector: any;
  
  constructor(agentId: string) {
    this.agentId = agentId;
    this.sessionId = this.generateSessionId();
    // Evidence collector will be set externally
    this.evidenceCollector = null;
  }

  /**
   * Set the evidence collector for this runner
   */
  setEvidenceCollector(collector: any): void {
    this.evidenceCollector = collector;
  }

  /**
   * Load a test checklist for the agent to execute
   */
  async loadChecklist(checklist: TestChecklistItem[]): Promise<void> {
    this.checklist = checklist.map(item => ({
      ...item,
      status: 'pending'
    }));
    this.currentItemIndex = 0;
    
    logger.info(`📋 Loaded checklist with ${this.checklist.length} items for agent ${this.agentId}`);
    logger.info(`Session ID: ${this.sessionId}`);
  }

  /**
   * Get the next test item the agent should work on
   */
  getCurrentTestItem(): TestChecklistItem | null {
    if (this.currentItemIndex >= this.checklist.length) {
      return null; // All tests completed
    }
    
    const currentItem = this.checklist[this.currentItemIndex];
    if (currentItem && currentItem.status === 'pending') {
      currentItem.status = 'in_progress';
      currentItem.timestamp = new Date().toISOString();
    }
    
    return currentItem || null;
  }

  /**
   * Agent reports starting work on a test item
   */
  async startTestItem(itemId: string): Promise<TestInstructions> {
    const item = this.findItemById(itemId);
    if (!item) {
      throw new Error(`Test item ${itemId} not found`);
    }
    
    if (item.status !== 'pending') {
      throw new Error(`Test item ${itemId} is not in pending status`);
    }
    
    // Mark as in progress and start evidence collection
    item.status = 'in_progress';
    item.timestamp = new Date().toISOString();
    
    this.evidenceCollector?.startCollecting(itemId);
    
    logger.info(`🏁 Agent ${this.agentId} started test: ${item.title}`);
    
    return {
      instructions: item.testInstructions,
      expectedOutcome: item.expectedOutcome,
      verificationCriteria: item.verificationCriteria,
      evidenceRequirements: this.getEvidenceRequirements(item)
    };
  }

  /**
   * Agent logs an action during test execution
   */
  async logAction(itemId: string, message: string, context?: any): Promise<void> {
    const log: TestLog = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      context
    };
    
    this.evidenceCollector?.addLog(itemId, log.message, log.context);
    logger.info(`📝 [${itemId}] ${message}`);
  }

  /**
   * Agent records a tool call during test execution
   */
  async recordToolCall(
    itemId: string,
    toolName: string,
    parameters: any,
    response: any,
    duration: number,
    success: boolean
  ): Promise<void> {
    const toolCall: ToolCall = {
      toolName,
      parameters,
      response,
      timestamp: new Date().toISOString(),
      duration,
      success
    };
    
    this.evidenceCollector?.addToolCall(itemId, toolCall);
    
    const status = success ? '✅' : '❌';
    logger.info(`🔧 [${itemId}] ${status} ${toolName} (${duration}ms)`);
  }

  /**
   * Agent completes a test item with results and comments
   */
  async completeTestItem(
    itemId: string,
    passed: boolean,
    agentComments: string,
    additionalEvidence?: Partial<TestEvidence>
  ): Promise<ChecklistCompletion> {
    const item = this.findItemById(itemId);
    if (!item) {
      throw new Error(`Test item ${itemId} not found`);
    }
    
    if (item.status !== 'in_progress') {
      throw new Error(`Test item ${itemId} is not in progress`);
    }
    
    // Stop evidence collection and gather all evidence
    const evidence = this.evidenceCollector ? 
      await this.evidenceCollector.stopCollecting(itemId) : 
      { logs: [], screenshots: [], measurements: [], networkRequests: [], errorMessages: [], toolCalls: [] };
    
    // Merge additional evidence provided by agent
    if (additionalEvidence) {
      evidence.screenshots.push(...(additionalEvidence.screenshots || []));
      evidence.measurements.push(...(additionalEvidence.measurements || []));
      evidence.errorMessages.push(...(additionalEvidence.errorMessages || []));
    }
    
    // Calculate duration
    const duration = item.timestamp ? 
      Date.now() - new Date(item.timestamp).getTime() : 0;
    
    // Update item with completion data
    item.status = passed ? 'completed' : 'failed';
    item.evidence = evidence;
    item.agentComments = agentComments;
    item.duration = duration;
    
    // Verify the evidence meets requirements
    const verification = await this.verifyEvidence(item);
    
    logger.info(`${passed ? '✅' : '❌'} Agent ${this.agentId} completed test: ${item.title}`);
    logger.info(`   Duration: ${duration}ms`);
    logger.info(`   Comments: ${agentComments}`);
    logger.info(`   Evidence: ${evidence.logs.length} logs, ${evidence.toolCalls.length} tool calls`);
    
    // Move to next item if current one passed
    if (passed && this.currentItemIndex < this.checklist.length - 1) {
      this.currentItemIndex++;
    }
    
    return {
      itemId,
      passed,
      verification,
      nextItemId: this.getNextPendingItemId(),
      evidence
    };
  }

  /**
   * Agent requests to skip a test item with reason
   */
  async skipTestItem(itemId: string, reason: string): Promise<void> {
    const item = this.findItemById(itemId);
    if (!item) {
      throw new Error(`Test item ${itemId} not found`);
    }
    
    item.status = 'skipped';
    item.agentComments = `SKIPPED: ${reason}`;
    item.timestamp = new Date().toISOString();
    
    logger.info(`⏭️  Agent ${this.agentId} skipped test: ${item.title} - ${reason}`);
    
    // Move to next item
    if (this.currentItemIndex < this.checklist.length - 1) {
      this.currentItemIndex++;
    }
  }

  /**
   * Get comprehensive checklist status
   */
  getChecklistStatus(): ChecklistStatus {
    const completed = this.checklist.filter(item => item.status === 'completed').length;
    const failed = this.checklist.filter(item => item.status === 'failed').length;
    const skipped = this.checklist.filter(item => item.status === 'skipped').length;
    const inProgress = this.checklist.filter(item => item.status === 'in_progress').length;
    const pending = this.checklist.filter(item => item.status === 'pending').length;
    
    const totalDuration = this.checklist
      .filter(item => item.duration)
      .reduce((sum, item) => sum + (item.duration || 0), 0);
    
    return {
      total: this.checklist.length,
      completed,
      failed,
      skipped,
      inProgress,
      pending,
      currentItemIndex: this.currentItemIndex,
      totalDuration,
      successRate: this.checklist.length > 0 ? (completed / this.checklist.length) * 100 : 0,
      checklist: [...this.checklist] // Return copy to prevent modification
    };
  }

  /**
   * Generate detailed completion report
   */
  generateReport(): ChecklistReport {
    const status = this.getChecklistStatus();
    
    return {
      sessionId: this.sessionId,
      agentId: this.agentId,
      startTime: this.checklist[0]?.timestamp || new Date().toISOString(),
      endTime: new Date().toISOString(),
      status,
      details: this.checklist.map(item => ({
        id: item.id,
        title: item.title,
        status: item.status,
        duration: item.duration || 0,
        comments: item.agentComments || '',
        evidenceSummary: {
          logsCount: item.evidence?.logs.length || 0,
          screenshotsCount: item.evidence?.screenshots.length || 0,
          toolCallsCount: item.evidence?.toolCalls.length || 0,
          errorsCount: item.evidence?.errorMessages.length || 0
        }
      }))
    };
  }

  // Private helper methods
  private findItemById(itemId: string): TestChecklistItem | undefined {
    return this.checklist.find(item => item.id === itemId);
  }

  private getNextPendingItemId(): string | null {
    const nextItem = this.checklist.find(item => item.status === 'pending');
    return nextItem?.id || null;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getEvidenceRequirements(_: TestChecklistItem): string[] {
    return [
      'Tool call logs with parameters and responses',
      'Screenshots before and after actions',
      'Any error messages or warnings',
      'Performance measurements if applicable',
      'Network requests if applicable'
    ];
  }

  private async verifyEvidence(item: TestChecklistItem): Promise<EvidenceVerification> {
    const evidence = item.evidence;
    if (!evidence) {
      return { valid: false, issues: ['No evidence provided'] };
    }

    const issues: string[] = [];
    
    // Check minimum evidence requirements
    if (evidence.logs.length === 0) {
      issues.push('No logs provided');
    }
    
    if (evidence.toolCalls.length === 0) {
      issues.push('No tool calls recorded');
    }
    
    // Verify tool calls are realistic (not too fast)
    const suspiciouslyFastCalls = evidence.toolCalls.filter(call => call.duration < 10);
    if (suspiciouslyFastCalls.length > 0) {
      issues.push(`${suspiciouslyFastCalls.length} tool calls completed suspiciously fast (<10ms)`);
    }
    
    return {
      valid: issues.length === 0,
      issues,
      evidenceQuality: this.calculateEvidenceQuality(evidence)
    };
  }

  private calculateEvidenceQuality(evidence: TestEvidence): number {
    let score = 0;
    
    // Base score for having evidence
    if (evidence.logs.length > 0) score += 20;
    if (evidence.toolCalls.length > 0) score += 30;
    if (evidence.screenshots.length > 0) score += 20;
    
    // Quality bonuses
    if (evidence.logs.length >= 3) score += 10; // Detailed logging
    if (evidence.toolCalls.some(call => call.duration > 50)) score += 10; // Realistic timing
    if (evidence.errorMessages.length === 0) score += 10; // Clean execution
    
    return Math.min(score, 100);
  }
}

// Supporting interfaces
export interface TestInstructions {
  instructions: string;
  expectedOutcome: string;
  verificationCriteria: string[];
  evidenceRequirements: string[];
}

export interface ChecklistCompletion {
  itemId: string;
  passed: boolean;
  verification: EvidenceVerification;
  nextItemId: string | null;
  evidence: TestEvidence;
}

export interface EvidenceVerification {
  valid: boolean;
  issues: string[];
  evidenceQuality?: number;
}

export interface ChecklistStatus {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  inProgress: number;
  pending: number;
  currentItemIndex: number;
  totalDuration: number;
  successRate: number;
  checklist: TestChecklistItem[];
}

export interface ChecklistReport {
  sessionId: string;
  agentId: string;
  startTime: string;
  endTime: string;
  status: ChecklistStatus;
  details: ChecklistItemSummary[];
}

export interface ChecklistItemSummary {
  id: string;
  title: string;
  status: string;
  duration: number;
  comments: string;
  evidenceSummary: {
    logsCount: number;
    screenshotsCount: number;
    toolCallsCount: number;
    errorsCount: number;
  };
}