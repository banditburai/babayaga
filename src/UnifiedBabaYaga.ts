import { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { BabaYagaConfig, Tool, ToolContext } from './types/index.js';
import { DefaultToolRegistry } from './tools/registry.js';
import { browserTools } from './tools/browser-tools.js';
import { visualTools } from './tools/visual-tools.js';

export class UnifiedBabaYaga {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private mcpServer: Server | null = null;
  private config: BabaYagaConfig;
  private toolRegistry: DefaultToolRegistry;

  constructor(config?: Partial<BabaYagaConfig>) {
    this.config = {
      headless: false,
      browserArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: null,
      screenshotPath: './screenshots',
      enablePerformanceTools: true,
      serverName: 'babayaga-unified',
      serverVersion: '1.0.0',
      ...config
    };
    
    this.toolRegistry = new DefaultToolRegistry();
  }

  async start(): Promise<void> {
    try {
      console.log('🚀 Starting Unified BabaYaga...');
      
      // 1. Launch browser
      await this.launchBrowser();
      
      // 2. Register all tools
      this.registerDefaultTools();
      
      // 3. Start MCP server
      await this.startMCPServer();
      
      console.log('✅ BabaYaga started successfully!');
      console.log(`🛠️  Available tools: ${this.toolRegistry.listNames().join(', ')}`);
    } catch (error) {
      console.error('❌ Failed to start BabaYaga:', error);
      await this.shutdown();
      throw error;
    }
  }

  private async launchBrowser(): Promise<void> {
    console.log('🌐 Launching browser...');
    
    this.browser = await puppeteer.launch({
      headless: this.config.headless,
      defaultViewport: this.config.defaultViewport,
      args: this.config.browserArgs
    });

    // Get or create first page
    const pages = await this.browser.pages();
    this.page = pages[0] || await this.browser.newPage();

    // Set up page event listeners
    this.setupPageListeners();
    
    console.log('✅ Browser launched');
  }

  private setupPageListeners(): void {
    if (!this.page) return;

    // Console logging
    this.page.on('console', msg => {
      const type = msg.type();
      if (type === 'error') {
        console.error(`[Browser Error] ${msg.text()}`);
      } else if (type === 'warn') {
        console.warn(`[Browser Warning] ${msg.text()}`);
      }
    });

    // Page errors
    this.page.on('pageerror', error => {
      console.error('[Page Error]', error.message);
    });

    // Dialog handling
    this.page.on('dialog', async dialog => {
      console.log(`[Dialog ${dialog.type()}] ${dialog.message()}`);
      await dialog.accept();
    });
  }

  private registerDefaultTools(): void {
    console.log('📦 Registering tools...');
    
    // Register browser control tools
    browserTools.forEach(tool => this.toolRegistry.register(tool));
    
    // Register visual tools
    visualTools.forEach(tool => this.toolRegistry.register(tool));
    
    // TODO: Add performance tools when enablePerformanceTools is true
  }

  private async startMCPServer(): Promise<void> {
    console.log('🔧 Starting MCP server...');
    
    this.mcpServer = new Server(
      {
        name: this.config.serverName!,
        version: this.config.serverVersion!,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Set up MCP handlers
    this.setupMCPHandlers();

    // Connect to stdio transport
    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);
    
    console.log('✅ MCP server started');
  }

  private setupMCPHandlers(): void {
    if (!this.mcpServer) return;

    // List tools handler
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.toolRegistry.list().map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }));
      
      return { tools };
    });

    // Call tool handler
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      const tool = this.toolRegistry.get(name);
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        // Validate required arguments
        if (tool.inputSchema.required) {
          for (const required of tool.inputSchema.required) {
            if (!(required in (args || {}))) {
              throw new Error(`Missing required argument: ${required}`);
            }
          }
        }

        // Create tool context
        const context: ToolContext = {
          page: this.page!,
          browser: this.browser!,
          config: this.config
        };

        // Execute tool
        const result = await tool.handler(args || {}, context);
        
        // Return result
        return {
          content: [{
            type: 'text',
            text: typeof result === 'string' 
              ? result 
              : JSON.stringify(result, null, 2)
          }]
        };
      } catch (error: any) {
        console.error(`Tool ${name} failed:`, error);
        throw new Error(`Tool ${name} failed: ${error.message}`);
      }
    });
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down BabaYaga...');
    
    if (this.mcpServer) {
      await this.mcpServer.close();
    }
    
    if (this.browser) {
      await this.browser.close();
    }
    
    console.log('👋 BabaYaga shut down complete');
  }

  // Public API for extending
  registerTool(tool: Tool): void {
    this.toolRegistry.register(tool);
  }

  getConfig(): BabaYagaConfig {
    return { ...this.config };
  }
}