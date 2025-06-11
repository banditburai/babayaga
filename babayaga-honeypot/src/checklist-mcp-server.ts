/**
 * Babayaga Honeypot MCP Server
 * Standalone MCP server for agent testing validation and verification
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { checklistCoordinator } from './agent-checklist-coordinator.js';
import { logger } from '@babayaga/shared';

export class ChecklistMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'babayaga-honeypot',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'initialize_agent_checklist',
          description: 'Initialize a new checklist testing session for an agent',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: { type: 'string', description: 'Unique identifier for the agent' },
              checklistPath: { type: 'string', description: 'Path to the checklist JSON file' }
            },
            required: ['agentId', 'checklistPath']
          }
        },
        {
          name: 'get_next_test',
          description: 'Get the next test item for the agent to execute',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: { type: 'string', description: 'Agent identifier' }
            },
            required: ['agentId']
          }
        },
        {
          name: 'log_test_action',
          description: 'Log an action the agent is taking during test execution',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: { type: 'string', description: 'Agent identifier' },
              itemId: { type: 'string', description: 'Test item ID' },
              action: { type: 'string', description: 'Description of action being taken' },
              context: { description: 'Additional context data' }
            },
            required: ['agentId', 'itemId', 'action']
          }
        },
        {
          name: 'record_tool_call',
          description: 'Record a tool call made by the agent with timing and results',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: { type: 'string', description: 'Agent identifier' },
              itemId: { type: 'string', description: 'Test item ID' },
              toolName: { type: 'string', description: 'Name of the tool that was called' },
              parameters: { description: 'Parameters passed to the tool' },
              response: { description: 'Response received from the tool' },
              duration: { type: 'number', description: 'Duration of the tool call in milliseconds' },
              success: { type: 'boolean', description: 'Whether the tool call was successful' }
            },
            required: ['agentId', 'itemId', 'toolName', 'parameters', 'response', 'duration', 'success']
          }
        },
        {
          name: 'complete_test_item',
          description: 'Mark a test item as completed with results and evidence',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: { type: 'string', description: 'Agent identifier' },
              itemId: { type: 'string', description: 'Test item ID' },
              passed: { type: 'boolean', description: 'Whether the test passed' },
              comments: { type: 'string', description: 'Agent comments about the test execution' },
              additionalEvidence: { description: 'Additional evidence data' }
            },
            required: ['agentId', 'itemId', 'passed', 'comments']
          }
        },
        {
          name: 'skip_test_item',
          description: 'Skip a test item with a reason',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: { type: 'string', description: 'Agent identifier' },
              itemId: { type: 'string', description: 'Test item ID' },
              reason: { type: 'string', description: 'Reason for skipping the test' }
            },
            required: ['agentId', 'itemId', 'reason']
          }
        },
        {
          name: 'get_checklist_status',
          description: 'Get the current status of the checklist for an agent',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: { type: 'string', description: 'Agent identifier' }
            },
            required: ['agentId']
          }
        },
        {
          name: 'get_checklist_report',
          description: 'Generate a final comprehensive report of all checklist results',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: { type: 'string', description: 'Agent identifier' }
            },
            required: ['agentId']
          }
        }
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return await this.handleToolCall(name, args);
    });
  }

  private async handleToolCall(name: string, args: any): Promise<any> {
    // Handle checklist tools
    switch (name) {
      case 'initialize_agent_checklist':
        return this.handleInitializeAgentChecklist(args);
      case 'get_next_test':
        return this.handleGetNextTest(args);
      case 'log_test_action':
        return this.handleLogTestAction(args);
      case 'record_tool_call':
        return this.handleRecordToolCall(args);
      case 'complete_test_item':
        return this.handleCompleteTestItem(args);
      case 'skip_test_item':
        return this.handleSkipTestItem(args);
      case 'get_checklist_status':
        return this.handleGetChecklistStatus(args);
      case 'get_checklist_report':
        return this.handleGetChecklistReport(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  // Checklist tool handlers
  private async handleInitializeAgentChecklist(args: any): Promise<any> {
    const input = args as { agentId: string; checklistPath: string };
    
    try {
      const result = await checklistCoordinator.initializeAgentChecklist(
        input.agentId,
        input.checklistPath
      );
      
      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error initializing checklist: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleGetNextTest(args: any): Promise<any> {
    const input = args as { agentId: string };
    
    try {
      const result = await checklistCoordinator.getNextTestForAgent(input.agentId);
      
      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting next test: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleLogTestAction(args: any): Promise<any> {
    const input = args as { agentId: string; itemId: string; action: string; context?: any };
    
    try {
      const result = await checklistCoordinator.logTestAction(
        input.agentId,
        input.itemId,
        input.action,
        input.context
      );
      
      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error logging action: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleRecordToolCall(args: any): Promise<any> {
    const input = args as { agentId: string; itemId: string; toolName: string; parameters: any; response: any; duration: number; success: boolean };
    
    try {
      const result = await checklistCoordinator.recordAgentToolCall(
        input.agentId,
        input.itemId,
        input.toolName,
        input.parameters,
        input.response,
        input.duration,
        input.success
      );
      
      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error recording tool call: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleCompleteTestItem(args: any): Promise<any> {
    const input = args as { agentId: string; itemId: string; passed: boolean; comments: string; additionalEvidence?: any };
    
    try {
      const result = await checklistCoordinator.completeTestItem(
        input.agentId,
        input.itemId,
        input.passed,
        input.comments,
        input.additionalEvidence
      );
      
      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error completing test item: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleSkipTestItem(args: any): Promise<any> {
    const input = args as { agentId: string; itemId: string; reason: string };
    
    try {
      const result = await checklistCoordinator.skipTestItem(
        input.agentId,
        input.itemId,
        input.reason
      );
      
      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error skipping test item: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleGetChecklistStatus(args: any): Promise<any> {
    const input = args as { agentId: string };
    
    try {
      const result = await checklistCoordinator.getChecklistStatus(input.agentId);
      
      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting checklist status: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleGetChecklistReport(args: any): Promise<any> {
    const input = args as { agentId: string };
    
    try {
      const result = await checklistCoordinator.generateChecklistReport(input.agentId);
      
      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error generating report: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Start the MCP server
   */
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('🍯 Babayaga Honeypot MCP Server running on stdio');
  }

  /**
   * Close the MCP server
   */
  async close(): Promise<void> {
    await this.server.close();
    logger.info('🍯 Babayaga Honeypot MCP Server closed');
  }
}