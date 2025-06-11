/**
 * Simplified MCP Server - Clean interface with structured responses
 * 
 * Provides MCP tools for checklist management with comprehensive
 * evidence collection and validation capabilities.
 */

import { randomUUID } from 'crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '@babayaga/shared';
import { SessionStore } from './session-store.js';
import { EvidenceStore } from './evidence-store.js';
import { TestExecutor } from './test-executor.js';
import { ChecklistEngine } from './checklist-engine.js';
import {
  TestSession,
  TestItem,
  TestResult,
  ToolCall,
  ToolResponse,
  SessionStatus,
  HoneypotError,
  SessionError,
  ValidationError as HoneypotValidationError
} from './types.js';

export class HoneypotMCPServer {
  private server: Server;
  private sessionStore: SessionStore;
  private evidenceStore: EvidenceStore;
  private testExecutor: TestExecutor;
  private checklistEngine: ChecklistEngine;
  private isShuttingDown = false;

  constructor() {
    this.server = new Server(
      {
        name: 'babayaga-honeypot',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize components
    this.sessionStore = new SessionStore();
    this.evidenceStore = new EvidenceStore();
    this.testExecutor = new TestExecutor(this.sessionStore, this.evidenceStore);
    this.checklistEngine = new ChecklistEngine();

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'session_create',
          description: 'Create a new test session with a checklist',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: { 
                type: 'string', 
                description: 'Unique identifier for the agent' 
              },
              checklistPath: { 
                type: 'string', 
                description: 'Path to the JSON checklist file' 
              },
              metadata: {
                type: 'object',
                description: 'Optional session metadata',
                properties: {
                  agentVersion: { type: 'string' },
                  environment: { type: 'string' },
                  tags: { type: 'array', items: { type: 'string' } },
                  notes: { type: 'string' }
                }
              }
            },
            required: ['agentId', 'checklistPath']
          }
        },
        {
          name: 'session_status',
          description: 'Get current status of a test session',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: { 
                type: 'string', 
                description: 'Session identifier' 
              }
            },
            required: ['sessionId']
          }
        },
        {
          name: 'test_get_next',
          description: 'Get the next pending test item',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: { 
                type: 'string', 
                description: 'Session identifier' 
              }
            },
            required: ['sessionId']
          }
        },
        {
          name: 'test_log_action',
          description: 'Log an action taken during test execution',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: { type: 'string', description: 'Session identifier' },
              itemId: { type: 'string', description: 'Test item identifier' },
              level: { 
                type: 'string', 
                enum: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
                description: 'Log level'
              },
              message: { type: 'string', description: 'Log message' },
              context: { type: 'object', description: 'Additional context data' }
            },
            required: ['sessionId', 'itemId', 'level', 'message']
          }
        },
        {
          name: 'test_record_tool',
          description: 'Record a tool call with evidence',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: { type: 'string', description: 'Session identifier' },
              itemId: { type: 'string', description: 'Test item identifier' },
              toolName: { type: 'string', description: 'Name of the tool called' },
              parameters: { type: 'object', description: 'Tool parameters' },
              response: { type: 'object', description: 'Tool response' },
              duration: { type: 'number', description: 'Execution duration in ms' },
              success: { type: 'boolean', description: 'Whether the tool call succeeded' },
              metadata: { type: 'object', description: 'Additional metadata' }
            },
            required: ['sessionId', 'itemId', 'toolName', 'parameters', 'response', 'duration', 'success']
          }
        },
        {
          name: 'test_complete',
          description: 'Complete a test item with results',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: { type: 'string', description: 'Session identifier' },
              itemId: { type: 'string', description: 'Test item identifier' },
              passed: { type: 'boolean', description: 'Whether the test passed' },
              comments: { type: 'string', description: 'Agent comments about the test' },
              evidenceQuality: { 
                type: 'number', 
                minimum: 0, 
                maximum: 1,
                description: 'Self-assessed evidence quality score (0-1)' 
              },
              validationIssues: { 
                type: 'array', 
                items: { type: 'string' },
                description: 'Any validation issues encountered' 
              },
              agentMetadata: { 
                type: 'object', 
                description: 'Agent-specific metadata' 
              }
            },
            required: ['sessionId', 'itemId', 'passed', 'comments', 'evidenceQuality']
          }
        },
        {
          name: 'test_skip',
          description: 'Skip a test item with reason',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: { type: 'string', description: 'Session identifier' },
              itemId: { type: 'string', description: 'Test item identifier' },
              reason: { type: 'string', description: 'Reason for skipping the test' }
            },
            required: ['sessionId', 'itemId', 'reason']
          }
        },
        {
          name: 'session_report',
          description: 'Generate final session report',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: { type: 'string', description: 'Session identifier' },
              includeEvidence: { 
                type: 'boolean', 
                description: 'Include detailed evidence in report' 
              },
              format: {
                type: 'string',
                enum: ['summary', 'detailed', 'full'],
                description: 'Report detail level'
              }
            },
            required: ['sessionId']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let result: ToolResponse;

        switch (name) {
          case 'session_create':
            result = await this.handleSessionCreate(args);
            break;
          case 'session_status':
            result = await this.handleSessionStatus(args);
            break;
          case 'test_get_next':
            result = await this.handleTestGetNext(args);
            break;
          case 'test_log_action':
            result = await this.handleTestLogAction(args);
            break;
          case 'test_record_tool':
            result = await this.handleTestRecordTool(args);
            break;
          case 'test_complete':
            result = await this.handleTestComplete(args);
            break;
          case 'test_skip':
            result = await this.handleTestSkip(args);
            break;
          case 'session_report':
            result = await this.handleSessionReport(args);
            break;
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        logger.error('Tool execution failed', { toolName: name, args }, error as Error);
        
        if (error instanceof McpError) {
          throw error;
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${(error as Error).message}`
        );
      }
    });
  }

  // ============================================================================
  // TOOL HANDLERS
  // ============================================================================

  private async handleSessionCreate(args: any): Promise<ToolResponse> {
    const startTime = Date.now();

    try {
      const { agentId, checklistPath, metadata = {} } = args;

      // Validate checklist
      const checklist = await this.checklistEngine.loadChecklist(checklistPath);
      
      // Create session
      const sessionId = randomUUID();
      const session: TestSession = {
        sessionId,
        agentId,
        checklistId: checklist.metadata.id,
        checklistPath,
        status: 'active',
        startTime: new Date().toISOString(),
        currentItemIndex: 0,
        items: checklist.items.map(item => ({
          ...item,
          status: 'pending',
          evidence: {
            logs: [],
            toolCalls: [],
            screenshots: [],
            measurements: [],
            errors: [],
            metadata: {}
          },
          timing: {
            timeoutMs: item.estimatedDuration ? item.estimatedDuration * 2 : undefined
          },
          metadata: {
            ...item.metadata,
            difficulty: item.difficulty || 'medium'
          }
        })),
        globalEvidence: {
          logs: [],
          toolCalls: [],
          screenshots: [],
          measurements: [],
          errors: [],
          metadata: {}
        },
        metadata
      };

      const createdSession = await this.sessionStore.createSession(session);

      return {
        success: true,
        data: {
          sessionId: createdSession.sessionId,
          agentId: createdSession.agentId,
          checklistId: createdSession.checklistId,
          checklistName: checklist.metadata.name,
          itemCount: createdSession.items.length,
          estimatedDuration: checklist.metadata.estimatedDuration,
          startTime: createdSession.startTime
        },
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          version: '2.0.0'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create session: ${(error as Error).message}`,
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          version: '2.0.0'
        }
      };
    }
  }

  private async handleSessionStatus(args: any): Promise<ToolResponse> {
    const startTime = Date.now();

    try {
      const { sessionId } = args;
      const session = await this.sessionStore.getSession(sessionId);

      if (!session) {
        return {
          success: false,
          error: `Session ${sessionId} not found`,
          metadata: {
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            sessionId,
            version: '2.0.0'
          }
        };
      }

      const itemCounts = {
        pending: session.items.filter(item => item.status === 'pending').length,
        active: session.items.filter(item => item.status === 'active').length,
        passed: session.items.filter(item => item.status === 'passed').length,
        failed: session.items.filter(item => item.status === 'failed').length,
        skipped: session.items.filter(item => item.status === 'skipped').length
      };

      const progress = {
        completed: itemCounts.passed + itemCounts.failed + itemCounts.skipped,
        total: session.items.length,
        percentage: Math.round(((itemCounts.passed + itemCounts.failed + itemCounts.skipped) / session.items.length) * 100)
      };

      return {
        success: true,
        data: {
          sessionId: session.sessionId,
          agentId: session.agentId,
          status: session.status,
          startTime: session.startTime,
          endTime: session.endTime,
          currentItemIndex: session.currentItemIndex,
          progress,
          itemCounts,
          checklistId: session.checklistId,
          metadata: session.metadata
        },
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          sessionId,
          version: '2.0.0'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get session status: ${(error as Error).message}`,
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          sessionId: args.sessionId,
          version: '2.0.0'
        }
      };
    }
  }

  private async handleTestGetNext(args: any): Promise<ToolResponse> {
    const startTime = Date.now();

    try {
      const { sessionId } = args;
      const nextItem = await this.testExecutor.getNextTestItem(sessionId);

      if (!nextItem) {
        return {
          success: true,
          data: null,
          metadata: {
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            sessionId,
            version: '2.0.0'
          }
        };
      }

      // Start the test item
      const activeItem = await this.testExecutor.startTestItem(sessionId, nextItem.id);

      return {
        success: true,
        data: {
          itemId: activeItem.id,
          title: activeItem.title,
          description: activeItem.description,
          instructions: activeItem.instructions,
          expectedOutcome: activeItem.expectedOutcome,
          verificationCriteria: activeItem.verificationCriteria,
          estimatedDuration: activeItem.metadata.estimatedDuration,
          difficulty: activeItem.metadata.difficulty,
          dependencies: activeItem.metadata.dependencies,
          tags: activeItem.metadata.tags,
          timeoutMs: activeItem.timing.timeoutMs,
          startTime: activeItem.timing.startTime
        },
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          sessionId,
          itemId: activeItem.id,
          version: '2.0.0'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get next test: ${(error as Error).message}`,
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          sessionId: args.sessionId,
          version: '2.0.0'
        }
      };
    }
  }

  private async handleTestLogAction(args: any): Promise<ToolResponse> {
    const startTime = Date.now();

    try {
      const { sessionId, itemId, level, message, context } = args;

      await this.testExecutor.logAction(sessionId, itemId, level, message, context);

      return {
        success: true,
        data: {
          logged: true,
          timestamp: new Date().toISOString()
        },
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          sessionId,
          itemId,
          version: '2.0.0'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to log action: ${(error as Error).message}`,
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          sessionId: args.sessionId,
          itemId: args.itemId,
          version: '2.0.0'
        }
      };
    }
  }

  private async handleTestRecordTool(args: any): Promise<ToolResponse> {
    const startTime = Date.now();

    try {
      const { sessionId, itemId, toolName, parameters, response, duration, success, metadata = {} } = args;

      const toolCall: ToolCall = {
        id: randomUUID(),
        toolName,
        parameters,
        response,
        timestamp: new Date().toISOString(),
        duration,
        success,
        sessionId,
        itemId,
        metadata
      };

      await this.testExecutor.recordToolCall(sessionId, toolCall);

      return {
        success: true,
        data: {
          toolCallId: toolCall.id,
          recorded: true,
          timestamp: toolCall.timestamp
        },
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          sessionId,
          itemId,
          version: '2.0.0'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to record tool call: ${(error as Error).message}`,
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          sessionId: args.sessionId,
          itemId: args.itemId,
          version: '2.0.0'
        }
      };
    }
  }

  private async handleTestComplete(args: any): Promise<ToolResponse> {
    const startTime = Date.now();

    try {
      const { sessionId, itemId, passed, comments, evidenceQuality, validationIssues = [], agentMetadata } = args;

      const result: Omit<TestResult, 'autoValidation'> = {
        passed,
        comments,
        evidenceQuality,
        validationIssues,
        agentMetadata
      };

      const completedItem = await this.testExecutor.completeTestItem(sessionId, itemId, result);

      // Get next test item if available
      const nextItem = await this.testExecutor.getNextTestItem(sessionId);

      return {
        success: true,
        data: {
          itemCompleted: {
            itemId: completedItem.id,
            status: completedItem.status,
            passed: completedItem.result?.passed,
            duration: completedItem.timing.duration,
            evidenceQuality: completedItem.result?.evidenceQuality,
            autoValidation: completedItem.result?.autoValidation
          },
          nextItem: nextItem ? {
            itemId: nextItem.id,
            title: nextItem.title,
            description: nextItem.description
          } : null,
          sessionComplete: !nextItem
        },
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          sessionId,
          itemId,
          version: '2.0.0'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to complete test: ${(error as Error).message}`,
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          sessionId: args.sessionId,
          itemId: args.itemId,
          version: '2.0.0'
        }
      };
    }
  }

  private async handleTestSkip(args: any): Promise<ToolResponse> {
    const startTime = Date.now();

    try {
      const { sessionId, itemId, reason } = args;

      const skippedItem = await this.testExecutor.skipTestItem(sessionId, itemId, reason);

      // Get next test item if available
      const nextItem = await this.testExecutor.getNextTestItem(sessionId);

      return {
        success: true,
        data: {
          itemSkipped: {
            itemId: skippedItem.id,
            status: skippedItem.status,
            reason
          },
          nextItem: nextItem ? {
            itemId: nextItem.id,
            title: nextItem.title,
            description: nextItem.description
          } : null,
          sessionComplete: !nextItem
        },
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          sessionId,
          itemId,
          version: '2.0.0'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to skip test: ${(error as Error).message}`,
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          sessionId: args.sessionId,
          itemId: args.itemId,
          version: '2.0.0'
        }
      };
    }
  }

  private async handleSessionReport(args: any): Promise<ToolResponse> {
    const startTime = Date.now();

    try {
      const { sessionId, includeEvidence = false, format = 'summary' } = args;

      const session = await this.sessionStore.getSession(sessionId);
      if (!session) {
        return {
          success: false,
          error: `Session ${sessionId} not found`,
          metadata: {
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            sessionId,
            version: '2.0.0'
          }
        };
      }

      const report = await this.generateSessionReport(session, includeEvidence, format);

      return {
        success: true,
        data: report,
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          sessionId,
          version: '2.0.0'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to generate report: ${(error as Error).message}`,
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          sessionId: args.sessionId,
          version: '2.0.0'
        }
      };
    }
  }

  // ============================================================================
  // REPORT GENERATION
  // ============================================================================

  private async generateSessionReport(session: TestSession, includeEvidence: boolean, format: string) {
    const itemCounts = {
      total: session.items.length,
      passed: session.items.filter(item => item.status === 'passed').length,
      failed: session.items.filter(item => item.status === 'failed').length,
      skipped: session.items.filter(item => item.status === 'skipped').length,
      pending: session.items.filter(item => item.status === 'pending').length
    };

    const totalDuration = session.items.reduce((sum, item) => 
      sum + (item.timing.duration || 0), 0);

    const averageEvidenceQuality = session.items
      .filter(item => item.result?.evidenceQuality !== undefined)
      .reduce((sum, item, _, arr) => sum + (item.result!.evidenceQuality / arr.length), 0);

    const deceptionIndicators = session.items
      .flatMap(item => item.result?.autoValidation?.deceptionIndicators || []);

    const summary = {
      sessionId: session.sessionId,
      agentId: session.agentId,
      checklistId: session.checklistId,
      status: session.status,
      duration: {
        startTime: session.startTime,
        endTime: session.endTime,
        totalMs: totalDuration,
        totalFormatted: this.formatDuration(totalDuration)
      },
      results: {
        ...itemCounts,
        successRate: itemCounts.total > 0 ? itemCounts.passed / itemCounts.total : 0,
        completionRate: itemCounts.total > 0 ? 
          (itemCounts.passed + itemCounts.failed + itemCounts.skipped) / itemCounts.total : 0
      },
      quality: {
        averageEvidenceQuality,
        deceptionIndicatorCount: deceptionIndicators.length,
        uniqueDeceptionIndicators: Array.from(new Set(deceptionIndicators))
      },
      metadata: session.metadata
    };

    if (format === 'summary') {
      return summary;
    }

    const detailed = {
      ...summary,
      items: session.items.map(item => ({
        id: item.id,
        title: item.title,
        status: item.status,
        duration: item.timing.duration,
        passed: item.result?.passed,
        evidenceQuality: item.result?.evidenceQuality,
        autoValidation: item.result?.autoValidation,
        comments: item.result?.comments,
        validationIssues: item.result?.validationIssues
      }))
    };

    if (format === 'detailed') {
      return detailed;
    }

    // Full format
    const full = {
      ...detailed,
      evidence: includeEvidence ? {
        globalLogs: session.globalEvidence.logs.length,
        globalToolCalls: session.globalEvidence.toolCalls.length,
        totalScreenshots: session.items.reduce((sum, item) => 
          sum + item.evidence.screenshots.length, 0),
        totalMeasurements: session.items.reduce((sum, item) => 
          sum + item.evidence.measurements.length, 0)
      } : undefined
    };

    return full;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // ============================================================================
  // ERROR HANDLING AND LIFECYCLE
  // ============================================================================

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      logger.error('MCP Server error', {}, error);
    };

    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  async start(): Promise<void> {
    try {
      // Start MCP server FIRST to avoid file operations interfering with tool detection
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      logger.info('Babayaga Honeypot MCP Server started successfully', {
        version: '2.0.0',
        capabilities: ['session_management', 'evidence_collection', 'auto_validation']
      });

      // Initialize components AFTER MCP connection is established
      // This prevents file operations from interfering with Cursor's tool detection
      setImmediate(async () => {
        try {
          await this.sessionStore.initialize();
          await this.evidenceStore.initialize();
          await this.testExecutor.initialize();
          await this.checklistEngine.initialize();
          logger.info('All components initialized successfully');
        } catch (error) {
          logger.error('Failed to initialize components after startup', {}, error as Error);
        }
      });

    } catch (error) {
      logger.fatal('Failed to start Babayaga Honeypot MCP Server', {}, error as Error);
      throw error;
    }
  }

  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('Shutting down Babayaga Honeypot MCP Server...');

    try {
      // Cleanup components
      await this.testExecutor.cleanup();
      await this.evidenceStore.cleanup();
      await this.sessionStore.cleanup();
      await this.checklistEngine.cleanup();

      // Close MCP server
      await this.server.close();

      logger.info('Babayaga Honeypot MCP Server shut down successfully');
      process.exit(0);
    } catch (error) {
      logger.fatal('Error during shutdown', {}, error as Error);
      process.exit(1);
    }
  }

  // ============================================================================
  // MONITORING AND METRICS
  // ============================================================================

  getMetrics() {
    return {
      server: {
        version: '2.0.0',
        uptime: process.uptime(),
        isShuttingDown: this.isShuttingDown
      },
      sessionStore: this.sessionStore.getMetrics(),
      evidenceStore: this.evidenceStore.getMetrics(),
      testExecutor: this.testExecutor.getMetrics(),
      checklistEngine: this.checklistEngine.getMetrics()
    };
  }
}