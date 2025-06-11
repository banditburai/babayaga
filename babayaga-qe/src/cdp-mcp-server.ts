import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import { CDPClient } from './cdp-client.js';
import { HealthChecker } from './health-checker.js';
import { 
  processCDPResponse, 
  formatCDPError, 
  CDPCommandError, 
  formatJsonResponse,
  normalizeError,
  delay
} from './utils.js';
import { 
  ServerConfig, 
  CDPTarget,
  CDPCommandInputSchema,
  ConnectTargetInputSchema,
  SyncPlaywrightInputSchema,
  ToolResponse,
  TOOL_NAMES,
  TOOL_DEFINITIONS,
  RESOURCE_URIS,
  DEFAULT_CONFIG,
  DEFAULT_OUTPUT_DIR
} from './types.js';
import { logger } from '@babayaga/shared';
import { 
  measureElementDimensions, 
  measureElementDistances, 
  analyzeLayoutGrid 
} from './measurements/element-analysis.js';
import {
  MeasureElementDimensionsInputSchema,
  MeasureElementDistancesInputSchema,
  AnalyzeLayoutGridInputSchema
} from './types/validation-schemas.js';

export class CDPMcpServer {
  private server: Server;
  private config: Required<ServerConfig>;
  private cdpClient: CDPClient | null = null;
  private currentTarget: CDPTarget | null = null;
  private healthChecker: HealthChecker;
  private isShuttingDown = false;
  private measurementCapabilitiesEnabled = false;
  private agentId: string;

  constructor(config: ServerConfig) {
    this.config = {
      cdpUrl: config.cdpUrl,
      connectionTimeout: config.connectionTimeout ?? DEFAULT_CONFIG.CONNECTION_TIMEOUT,
      commandTimeout: config.commandTimeout ?? DEFAULT_CONFIG.COMMAND_TIMEOUT,
      reconnectAttempts: config.reconnectAttempts ?? DEFAULT_CONFIG.RECONNECT_ATTEMPTS,
      reconnectDelay: config.reconnectDelay ?? DEFAULT_CONFIG.RECONNECT_DELAY,
      outputDir: config.outputDir ?? DEFAULT_OUTPUT_DIR,
    };

    this.agentId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.healthChecker = new HealthChecker(null, this.config.cdpUrl);
    
    logger.info('CDP MCP Server initialized', { 
      config: this.config, 
      agentId: this.agentId 
    });

    this.server = new Server(
      {
        name: 'CDP MCP Server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Tool handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOL_DEFINITIONS,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const startTime = Date.now();

      try {
        logger.debug('Handling tool request', { name, args });
        
        let result: ToolResponse;
        switch (name) {
          case TOOL_NAMES.CDP_SEND_COMMAND:
            result = await this.handleSendCommand(args);
            break;
          case TOOL_NAMES.CDP_LIST_TARGETS:
            result = await this.handleListTargets();
            break;
          case TOOL_NAMES.CDP_CONNECT_TARGET:
            result = await this.handleConnectTarget(args);
            break;
          case TOOL_NAMES.CDP_HEALTH_CHECK:
            result = await this.handleHealthCheck();
            break;
          case TOOL_NAMES.CDP_SYNC_PLAYWRIGHT:
            result = await this.handleSyncPlaywright(args);
            break;
          // Measurement tools
          case TOOL_NAMES.QA_MEASURE_ELEMENT:
            result = await this.handleMeasureElement(args);
            break;
          case TOOL_NAMES.QA_MEASURE_DISTANCES:
            result = await this.handleMeasureDistances(args);
            break;
          case TOOL_NAMES.QA_ANALYZE_LAYOUT_GRID:
            result = await this.handleAnalyzeLayoutGrid(args);
            break;
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
        
        const duration = Date.now() - startTime;
        logger.info('Tool request completed', { name, duration });
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        if (error instanceof McpError) {
          logger.error('MCP error in tool request', { name, duration }, error);
          throw error;
        }
        
        const errorMessage = normalizeError(error);
        logger.error('Error in tool request', { name, duration, error: errorMessage }, error as Error);
        
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
        };
      }
    });

    // Resource handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: RESOURCE_URIS.CONNECTION_STATUS,
          name: 'CDP Connection Status',
          description: 'Current connection status and target information',
          mimeType: 'application/json',
        },
      ],
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      if (uri === RESOURCE_URIS.CONNECTION_STATUS) {
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(
                {
                  connected: this.cdpClient?.connected ?? false,
                  currentTarget: this.currentTarget,
                  cdpUrl: this.config.cdpUrl,
                  serverConfig: this.config,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
    });
  }

  private async handleSendCommand(args: unknown): Promise<ToolResponse> {
    const input = CDPCommandInputSchema.parse(args);
    const startTime = Date.now();
    
    if (!this.cdpClient?.connected) {
      throw new CDPCommandError(
        'Not connected to any CDP target. Use cdp_connect_target first.',
        input.method
      );
    }

    try {
      const response = await this.cdpClient.sendCommand(input.method, input.params);
      
      if (response.error) {
        throw new CDPCommandError(
          formatCDPError(response),
          input.method,
          response.error
        );
      }

      const processed = await processCDPResponse(response.result, {
        outputDir: this.config.outputDir,
        saveFiles: true,
      });

      const duration = Date.now() - startTime;
      this.healthChecker.recordCommand(input.method, true, duration);
      
      return formatJsonResponse(processed);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.healthChecker.recordCommand(input.method, false, duration);
      
      if (error instanceof CDPCommandError) throw error;
      
      throw new CDPCommandError(
        `CDP command failed: ${normalizeError(error)}`,
        input.method,
        error
      );
    }
  }

  private async handleListTargets(): Promise<ToolResponse> {
    try {
      const targets = await CDPClient.getTargets(this.config.cdpUrl);
      
      return formatJsonResponse({
        count: targets.length,
        targets: targets.map(t => ({
          id: t.id,
          type: t.type,
          title: t.title,
          url: t.url,
        })),
      });
    } catch (error) {
      throw new Error(`Failed to list targets: ${normalizeError(error)}`);
    }
  }

  private async handleConnectTarget(args: unknown): Promise<ToolResponse> {
    const input = ConnectTargetInputSchema.parse(args);
    
    await this.disconnectCurrent();
    const target = await this.findTarget(input.targetId);
    await this.connectWithRetries(target);
    
    return this.formatConnectionResponse(target);
  }

  private async handleHealthCheck(): Promise<ToolResponse> {
    const healthStatus = await this.healthChecker.performHealthCheck();
    return formatJsonResponse(healthStatus);
  }

  private async handleSyncPlaywright(args: unknown): Promise<ToolResponse> {
    const input = SyncPlaywrightInputSchema.parse(args);
    
    // Try to detect CDP URL if not provided
    let cdpUrl = input.playwrightCdpUrl;
    
    if (!cdpUrl) {
      // Try common ports where Playwright might be running
      const commonPorts = [9222, 9223, 9224, 9225];
      for (const port of commonPorts) {
        try {
          const testUrl = `http://localhost:${port}/json`;
          const response = await fetch(testUrl);
          if (response.ok) {
            cdpUrl = `http://localhost:${port}`;
            break;
          }
        } catch {
          // Continue to next port
        }
      }
      
      if (!cdpUrl) {
        throw new Error('Could not detect Playwright CDP endpoint. Please provide playwrightCdpUrl parameter or ensure Playwright is running with CDP enabled.');
      }
    }
    
    logger.info('Synchronizing with Playwright browser', { cdpUrl });
    
    // Update our configuration to point to the Playwright CDP endpoint
    this.config.cdpUrl = cdpUrl;
    this.healthChecker = new HealthChecker(null, cdpUrl);
    
    // Get targets from the Playwright browser
    const targets = await CDPClient.getPageTargets(cdpUrl);
    
    if (targets.length === 0) {
      throw new Error('No page targets found in Playwright browser. Make sure Playwright has navigated to a page.');
    }
    
    // Connect to the first available target (usually the most recent)
    const target = targets[0];
    await this.disconnectCurrent();
    await this.connectWithRetries(target);
    
    // Enable required CDP domains for measurements
    await this.ensureMeasurementCapabilities();
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            synchronized: true,
            playwrightCdpUrl: cdpUrl,
            connectedTarget: {
              id: target.id,
              title: target.title,
              url: target.url,
            },
            enabledDomains: ['DOM', 'CSS', 'Runtime', 'Page'],
            availableTargets: targets.length,
          }, null, 2),
        },
      ],
    };
  }

  // Measurement tool handlers
  private async handleMeasureElement(args: unknown): Promise<ToolResponse> {
    const input = MeasureElementDimensionsInputSchema.parse(args);
    
    if (!this.cdpClient || !this.cdpClient.connected) {
      throw new McpError(ErrorCode.InternalError, 'Not connected to a CDP target');
    }

    // Ensure DOM and CSS are enabled for measurements
    await this.ensureMeasurementCapabilities();

    const measurement = await measureElementDimensions(this.cdpClient, input);
    
    return formatJsonResponse(measurement);
  }

  private async handleMeasureDistances(args: unknown): Promise<ToolResponse> {
    const input = MeasureElementDistancesInputSchema.parse(args);
    
    if (!this.cdpClient || !this.cdpClient.connected) {
      throw new McpError(ErrorCode.InternalError, 'Not connected to a CDP target');
    }

    // Ensure DOM and CSS are enabled for measurements
    await this.ensureMeasurementCapabilities();

    const measurement = await measureElementDistances(this.cdpClient, input);
    
    return formatJsonResponse(measurement);
  }

  private async handleAnalyzeLayoutGrid(args: unknown): Promise<ToolResponse> {
    const input = AnalyzeLayoutGridInputSchema.parse(args);
    
    if (!this.cdpClient || !this.cdpClient.connected) {
      throw new McpError(ErrorCode.InternalError, 'Not connected to a CDP target');
    }

    // Ensure DOM and CSS are enabled for measurements
    await this.ensureMeasurementCapabilities();

    const analysis = await analyzeLayoutGrid(this.cdpClient, input);
    
    return formatJsonResponse(analysis);
  }

  // Helper methods for SRP compliance
  private async ensureMeasurementCapabilities(): Promise<void> {
    if (!this.cdpClient) {
      throw new Error('CDP client not initialized');
    }

    // Skip if already enabled
    if (this.measurementCapabilitiesEnabled) {
      return;
    }

    try {
      // Enable DOM - required for element queries
      await this.cdpClient.sendCommand('DOM.enable', {});
      
      // Enable CSS - required for computed styles
      await this.cdpClient.sendCommand('CSS.enable', {});
      
      this.measurementCapabilitiesEnabled = true;
      logger.debug('DOM and CSS capabilities enabled for measurements');
    } catch (error) {
      logger.error('Failed to enable measurement capabilities', {}, error as Error);
      throw new Error('Failed to enable DOM/CSS capabilities for measurements');
    }
  }

  private async disconnectCurrent(): Promise<void> {
    if (this.cdpClient) {
      logger.info('Disconnecting from current target');
      this.cdpClient.disconnect();
      this.cdpClient = null;
      this.currentTarget = null;
      this.measurementCapabilitiesEnabled = false;
      this.healthChecker.updateClient(null);
    }
  }

  private async findTarget(targetId?: string): Promise<CDPTarget> {
    const targets = await CDPClient.getPageTargets(this.config.cdpUrl);
    
    if (targets.length === 0) {
      throw new Error('No page targets available. Make sure Chrome is running with --remote-debugging-port');
    }

    if (targetId) {
      const target = targets.find(t => t.id === targetId);
      if (!target) {
        throw new Error(`Target with ID '${targetId}' not found`);
      }
      return target;
    }
    
    return targets[0];
  }

  private async connectWithRetries(target: CDPTarget): Promise<void> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.reconnectAttempts; attempt++) {
      try {
        await this.connectToTarget(target);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`Connection attempt ${attempt} failed`, { 
          attempt, 
          maxAttempts: this.config.reconnectAttempts,
          targetId: target.id,
          error: lastError.message 
        });
        
        if (attempt < this.config.reconnectAttempts) {
          await delay(this.config.reconnectDelay);
        }
      }
    }
    
    throw new Error(`Failed to connect after ${this.config.reconnectAttempts} attempts: ${lastError?.message}`);
  }

  private async connectToTarget(target: CDPTarget): Promise<void> {
    this.cdpClient = new CDPClient(target.webSocketDebuggerUrl, {
      connectionTimeout: this.config.connectionTimeout,
      commandTimeout: this.config.commandTimeout,
    });

    this.setupClientEventHandlers();
    await this.cdpClient.connect();
    this.currentTarget = target;
    this.healthChecker.updateClient(this.cdpClient);
    
    logger.info('Successfully connected to CDP target', {
      targetId: target.id,
      title: target.title,
      url: target.url
    });
  }

  private setupClientEventHandlers(): void {
    if (!this.cdpClient) return;

    this.cdpClient.on('error', (error) => {
      logger.error('CDP Client error', { targetId: this.currentTarget?.id }, error);
    });

    this.cdpClient.on('disconnected', (info) => {
      logger.warn('CDP Client disconnected', { 
        targetId: this.currentTarget?.id,
        ...info 
      });
      this.currentTarget = null;
      this.healthChecker.updateClient(null);
    });
  }

  private formatConnectionResponse(target: CDPTarget): ToolResponse {
    return formatJsonResponse({
      connected: true,
      target: {
        id: target.id,
        title: target.title,
        url: target.url,
      },
    });
  }

  async start(): Promise<void> {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      logger.info('CDP MCP Server started successfully', {
        version: '1.0.0',
        cdpUrl: this.config.cdpUrl
      });
      
      // Set up graceful shutdown
      process.on('SIGINT', () => this.shutdown());
      process.on('SIGTERM', () => this.shutdown());
    } catch (error) {
      logger.fatal('Failed to start CDP MCP Server', {}, error as Error);
      throw error;
    }
  }

  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    logger.info('Shutting down CDP MCP Server...');
    
    try {
      if (this.cdpClient) {
        this.cdpClient.disconnect();
      }
      await this.server.close();
      logger.info('CDP MCP Server shut down successfully');
      process.exit(0);
    } catch (error) {
      logger.fatal('Error during shutdown', {}, error as Error);
      process.exit(1);
    }
  }

}