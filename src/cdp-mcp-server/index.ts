import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ChromeDevToolsClient } from './cdpClient.js';
import { CDPClient } from './types.js';

interface CDPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: any;
    required?: string[];
  };
}

export class CDPMCPServer {
  private server: Server;
  private cdpClient: ChromeDevToolsClient;
  private activeClient?: CDPClient;

  constructor() {
    this.server = new Server(
      {
        name: 'cdp-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.cdpClient = new ChromeDevToolsClient();
    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: CDPTool[] = [
        {
          name: 'cdp_connect',
          description: 'Connect to Chrome DevTools Protocol',
          inputSchema: {
            type: 'object',
            properties: {
              targetId: {
                type: 'string',
                description: 'Optional target ID to connect to',
              },
            },
          },
        },
        {
          name: 'cdp_list_targets',
          description: 'List available Chrome targets',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'cdp_evaluate',
          description: 'Evaluate JavaScript in the page',
          inputSchema: {
            type: 'object',
            properties: {
              expression: {
                type: 'string',
                description: 'JavaScript expression to evaluate',
              },
            },
            required: ['expression'],
          },
        },
        {
          name: 'cdp_get_console_messages',
          description: 'Get console messages from the page',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of messages to return',
                default: 10,
              },
            },
          },
        },
        {
          name: 'cdp_get_computed_style',
          description: 'Get computed style for an element',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for the element',
              },
            },
            required: ['selector'],
          },
        },
      ];

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      // Type guard for args
      const toolArgs = args as Record<string, any> | undefined;

      switch (name) {
        case 'cdp_connect':
          return await this.connect(toolArgs?.targetId as string | undefined);

        case 'cdp_list_targets':
          return await this.listTargets();

        case 'cdp_evaluate':
          return await this.evaluate((toolArgs?.expression as string) || '');

        case 'cdp_get_console_messages':
          return await this.getConsoleMessages((toolArgs?.limit as number) || 10);

        case 'cdp_get_computed_style':
          return await this.getComputedStyle((toolArgs?.selector as string) || '');

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private async connect(targetId?: string) {
    try {
      this.activeClient = await this.cdpClient.connect(targetId);
      
      // Enable necessary domains
      await this.activeClient.send('Runtime.enable');
      await this.activeClient.send('Console.enable');
      await this.activeClient.send('DOM.enable');
      await this.activeClient.send('CSS.enable');

      return {
        content: [
          {
            type: 'text',
            text: 'Successfully connected to Chrome DevTools Protocol',
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to connect: ${error}`,
          },
        ],
      };
    }
  }

  private async listTargets() {
    try {
      const targets = await this.cdpClient.listTargets();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(targets, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list targets: ${error}`,
          },
        ],
      };
    }
  }

  private async evaluate(expression: string) {
    if (!this.activeClient) {
      throw new Error('Not connected to Chrome DevTools');
    }

    try {
      const result = await this.activeClient.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result.result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Evaluation failed: ${error}`,
          },
        ],
      };
    }
  }

  private consoleMessages: any[] = [];

  private async getConsoleMessages(limit: number) {
    if (!this.activeClient) {
      throw new Error('Not connected to Chrome DevTools');
    }

    // Set up console message listener if not already done
    if (this.consoleMessages.length === 0) {
      this.activeClient.on('Console.messageAdded', (params) => {
        this.consoleMessages.push(params.message);
      });
    }

    const messages = this.consoleMessages.slice(-limit);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(messages, null, 2),
        },
      ],
    };
  }

  private async getComputedStyle(selector: string) {
    if (!this.activeClient) {
      throw new Error('Not connected to Chrome DevTools');
    }

    try {
      // Get document
      const { root } = await this.activeClient.send('DOM.getDocument');
      
      // Query selector
      const { nodeId } = await this.activeClient.send('DOM.querySelector', {
        nodeId: root.nodeId,
        selector,
      });

      if (!nodeId) {
        throw new Error(`Element not found: ${selector}`);
      }

      // Get computed style
      const { computedStyle } = await this.activeClient.send('CSS.getComputedStyleForNode', {
        nodeId,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(computedStyle, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to get computed style: ${error}`,
          },
        ],
      };
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('CDP MCP Server running on stdio');
  }
}

// Start the server
const server = new CDPMCPServer();
server.start().catch(console.error);