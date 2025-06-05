#!/usr/bin/env tsx
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ServiceDiscovery } from '../utils/service-discovery';
import { ToolRegistryImpl } from './tools/registry';
import { ServiceConfig, ToolResponse, VisualRegressionParams } from '../types/mcp';
import { VisualRegressionTool } from './tools/builtin/visual-regression';
import { SaveScreenshotTool } from './tools/builtin/save-screenshot';
import { createDefaultTransformers, TransformerChain } from './tools/transformers';
import { CompositeToolManager } from './tools/composite';
import { StreamingResponseHandler } from './tools/streaming';
import { ToolChainExecutor, PREDEFINED_CHAINS } from './tools/chaining';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class BabaYagaMCPServer {
  private server: Server;
  private serviceDiscovery: ServiceDiscovery;
  private toolRegistry: ToolRegistryImpl;
  private visualRegressionTool: VisualRegressionTool;
  private saveScreenshotTool: SaveScreenshotTool;
  private transformers: TransformerChain;
  private compositeToolManager: CompositeToolManager;
  private streamingHandler: StreamingResponseHandler;
  private chainExecutor: ToolChainExecutor;

  constructor(serviceConfig: ServiceConfig[]) {
    this.server = new Server(
      {
        name: 'babayaga-mcp-server',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.serviceDiscovery = new ServiceDiscovery(serviceConfig);
    this.toolRegistry = new ToolRegistryImpl();
    this.visualRegressionTool = new VisualRegressionTool();
    this.saveScreenshotTool = new SaveScreenshotTool();
    this.transformers = createDefaultTransformers();
    this.compositeToolManager = new CompositeToolManager(this.serviceDiscovery);
    this.streamingHandler = new StreamingResponseHandler();
    this.chainExecutor = new ToolChainExecutor(this.serviceDiscovery, this.transformers);
    
    this.setupServer();
  }

  private setupServer() {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.toolRegistry.getTools();
      return { tools } as const;
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request): Promise<any> => {
      const { name, arguments: args } = request.params;
      
      if (!args) {
        throw new Error('No arguments provided for tool call');
      }

      // Check if it's a composite tool
      const tool = this.toolRegistry.getTool(name);
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      // Handle different tool types
      if (tool.service === 'composite') {
        return await this.handleCompositeTool(name, args);
      } else if (tool.service) {
        // Proxy to specific service
        const service = this.serviceDiscovery.getService(tool.service);
        if (!service) {
          throw new Error(`Service ${tool.service} not available`);
        }
        
        // Remove service prefix from tool name (only from the beginning)
        const prefix = `${tool.service}_`;
        const originalToolName = name.startsWith(prefix) ? name.substring(prefix.length) : name;
        const response = await service.callTool(originalToolName, args);
        
        // Check if response is large and needs streaming
        const streamingContext = this.streamingHandler.isLargeResponse(response);
        if (streamingContext.isLargeResponse) {
          return await this.streamingHandler.createStreamingResponse(response, streamingContext);
        }
        
        // Apply transformations
        return await this.transformers.transform({
          toolName: originalToolName,
          serviceName: tool.service,
          originalResponse: response,
          metadata: args,
        });
      }

      // Handle built-in tools
      switch (name) {
        case 'visual-regression':
          const { url, baselineName } = args as Record<string, any>;
          if (!url || !baselineName) {
            throw new Error('Missing required parameters for visual-regression');
          }
          return await this.handleVisualRegression({ url, baselineName });
          
        case 'save_screenshot':
          const { base64Data, filename } = args as Record<string, any>;
          if (!base64Data) {
            throw new Error('Missing required parameter: base64Data');
          }
          return await this.saveScreenshotTool.saveScreenshot(base64Data, filename);
          
        case 'list_screenshots':
          return await this.saveScreenshotTool.listScreenshots();
          
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private async handleCompositeTool(toolName: string, args: any): Promise<ToolResponse> {
    if (this.compositeToolManager.hasHandler(toolName)) {
      return await this.compositeToolManager.execute(toolName, args);
    }
    
    // Legacy inline handlers (to be migrated)
    switch (toolName) {
      case 'web_performance_test': {
        const results: any = {
          url: args.url,
          timestamp: new Date().toISOString(),
        };

        // Take screenshot if puppeteer is available
        const puppeteerService = this.serviceDiscovery.getService('puppeteer');
        if (puppeteerService && args.screenshotName) {
          try {
            const screenshotResult = await puppeteerService.callTool('screenshot', {
              name: args.screenshotName,
            });
            results.screenshot = screenshotResult;
          } catch (error) {
            results.screenshotError = String(error);
          }
        }

        // Collect metrics if CDP is available
        const cdpService = this.serviceDiscovery.getService('cdp');
        if (cdpService && args.metrics) {
          results.metrics = {};
          
          for (const metric of args.metrics) {
            try {
              switch (metric) {
                case 'performance':
                  const perfResult = await cdpService.callTool('cdp_command', {
                    method: 'Performance.getMetrics',
                  });
                  results.metrics.performance = perfResult;
                  break;
                case 'console':
                  const consoleResult = await cdpService.callTool('cdp_command', {
                    method: 'Runtime.evaluate',
                    params: JSON.stringify({
                      expression: 'console.logs || []',
                    }),
                  });
                  results.metrics.console = consoleResult;
                  break;
              }
            } catch (error) {
              results.metrics[`${metric}Error`] = String(error);
            }
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(results, null, 2),
          }],
        };
      }

      case 'visual_regression_with_metrics': {
        const result = await this.visualRegressionTool.comparePage(
          args.url,
          args.baselineName
        );
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        };
      }
      
      default:
        // Check if it's a chain tool
        if (toolName.startsWith('chain_')) {
          const chainName = toolName.replace('chain_', '');
          const chain = PREDEFINED_CHAINS.find(c => c.name === chainName);
          if (chain) {
            return await this.chainExecutor.executeChain(chain, args);
          }
        }
        throw new Error(`Unknown composite tool: ${toolName}`);
    }
  }

  private async handleVisualRegression(args: VisualRegressionParams): Promise<ToolResponse> {
    await this.visualRegressionTool.initialize();
    try {
      const result = await this.visualRegressionTool.comparePage(
        args.url,
        args.baselineName
      );
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    } finally {
      await this.visualRegressionTool.cleanup();
    }
  }

  async start() {
    try {
      // Create necessary directories
      await fs.mkdir('./cdp-output', { recursive: true });
      
      // Check if Chrome is running, start if needed
      if (process.env.BABAYAGA_AUTO_START_CHROME !== 'false') {
        await this.ensureChromeRunning();
      }
      
      // Discover and connect to services
      await this.serviceDiscovery.discoverAndConnect();
      
      // Import tools from all connected services
      for (const service of this.serviceDiscovery.getAllServices()) {
        try {
          const tools = await service.getTools();
          await this.toolRegistry.importFromService(service.name, tools);
          console.log(`Imported ${tools.length} tools from ${service.name}`);
        } catch (error) {
          console.error(`Failed to import tools from ${service.name}:`, error);
        }
      }
      
      // Auto-connect Puppeteer to existing Chrome instance
      await this.autoConnectPuppeteer();
      
      // Register built-in tools
      this.toolRegistry.register({
        name: 'visual-regression',
        description: 'Compare screenshots of web pages for visual regression testing',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL of the page to test',
            },
            baselineName: {
              type: 'string',
              description: 'Name for the baseline screenshot',
            },
          },
          required: ['url', 'baselineName'],
        },
      });
      
      this.toolRegistry.register({
        name: 'save_screenshot',
        description: 'Save a screenshot from base64 data to local file',
        inputSchema: {
          type: 'object',
          properties: {
            base64Data: {
              type: 'string',
              description: 'Base64 encoded image data (with or without data URL prefix)',
            },
            filename: {
              type: 'string',
              description: 'Optional filename for the screenshot (defaults to timestamp)',
            },
          },
          required: ['base64Data'],
        },
      });
      
      this.toolRegistry.register({
        name: 'list_screenshots',
        description: 'List all saved screenshots in the screenshots directory',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      });
      
      // Create composite tools
      this.toolRegistry.createCompositeTools();
      
      // Register chain tools
      for (const chain of PREDEFINED_CHAINS) {
        this.toolRegistry.register({
          name: `chain_${chain.name}`,
          description: chain.description,
          service: 'composite',
          inputSchema: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'URL for the chain (if applicable)' },
              targetSelector: { type: 'string', description: 'Target selector (if applicable)' },
              expectedSelector: { type: 'string', description: 'Expected selector (if applicable)' },
            },
          },
        });
      }
      
      // Connect to stdio transport
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      console.log('BabaYaga MCP Server v2.0 started successfully');
      console.log(`Available tools: ${this.toolRegistry.getTools().map(t => t.name).join(', ')}`);
    } catch (error) {
      console.error('Failed to start BabaYaga MCP Server:', error);
      await this.shutdown();
      process.exit(1);
    }
  }

  private async ensureChromeRunning(): Promise<void> {
    const port = process.env.CHROME_DEBUG_PORT || '9222';
    
    // Check if Chrome is already running
    try {
      const response = await fetch(`http://localhost:${port}/json/version`);
      if (response.ok) {
        const version = await response.json() as { Browser: string };
        console.log(`Chrome already running: ${version.Browser}`);
        return;
      }
    } catch {
      // Chrome not running, we'll start it
    }
    
    console.log('Starting Chrome with remote debugging...');
    
    // Use the existing start-chrome script
    const scriptPath = path.join(path.dirname(path.dirname(__dirname)), 'scripts', 'start-chrome.js');
    
    return new Promise((resolve, reject) => {
      const chromeProcess = spawn('node', [scriptPath], {
        detached: true,
        stdio: 'inherit',
        env: { ...process.env },
      });
      
      chromeProcess.unref();
      
      // Give Chrome time to start
      const checkInterval = setInterval(async () => {
        try {
          const response = await fetch(`http://localhost:${port}/json/version`);
          if (response.ok) {
            clearInterval(checkInterval);
            console.log('Chrome started successfully');
            resolve();
          }
        } catch {
          // Still waiting
        }
      }, 1000);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Failed to start Chrome within 30 seconds'));
      }, 30000);
    });
  }

  private async autoConnectPuppeteer(): Promise<void> {
    const puppeteerService = this.serviceDiscovery.getService('puppeteer');
    if (!puppeteerService) {
      console.log('Puppeteer service not available, skipping auto-connect');
      return;
    }

    try {
      // Check if Chrome is running and has tabs
      const port = process.env.CHROME_DEBUG_PORT || '9222';
      const response = await fetch(`http://localhost:${port}/json`);
      const tabs = await response.json() as Array<{ id: string; type: string; url: string }>;
      
      if (tabs.length === 0) {
        console.log('No Chrome tabs available, creating new tab for Puppeteer connection');
        // Create a new tab
        await fetch(`http://localhost:${port}/json/new?about:blank`);
      }

      // Connect Puppeteer to the existing Chrome instance
      console.log('Connecting Puppeteer to existing Chrome instance...');
      await puppeteerService.callTool('connect_active_tab', {});
      console.log('Puppeteer connected to Chrome successfully');
    } catch (error) {
      console.warn('Failed to auto-connect Puppeteer to Chrome:', error instanceof Error ? error.message : error);
      console.log('Puppeteer will attempt to launch its own browser instance');
    }
  }

  async shutdown() {
    await this.serviceDiscovery.shutdown();
    await this.server.close();
  }
}

// Default service configuration
const defaultServiceConfig: ServiceConfig[] = [
  {
    name: 'puppeteer',
    command: 'npm',
    args: ['run', 'start:puppeteer-mcp'],
    healthCheckInterval: 30000,
  },
  {
    name: 'cdp',
    command: 'npm',
    args: ['run', 'start:cdp-mcp'],
    healthCheckInterval: 30000,
  },
];

// Allow configuration via environment or config file
async function loadConfig(): Promise<ServiceConfig[]> {
  try {
    const configPath = process.env.BABAYAGA_CONFIG || './babayaga.config.json';
    const configData = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configData);
  } catch {
    return defaultServiceConfig;
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  loadConfig().then(config => {
    const server = new BabaYagaMCPServer(config);
    
    process.on('SIGINT', async () => {
      console.log('\nShutting down BabaYaga MCP Server...');
      await server.shutdown();
      process.exit(0);
    });

    server.start().catch((error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });
  });
}