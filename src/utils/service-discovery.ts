import { ServiceConfig, MCPService } from '../types/mcp';
import { PooledMCPService, ConnectionPoolConfig } from './connection-pool';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcess } from 'child_process';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export class ServiceDiscovery {
  private services: Map<string, MCPServiceImpl> = new Map();
  private config: ServiceConfig[];

  constructor(config: ServiceConfig[]) {
    this.config = config;
  }

  async discoverAndConnect(): Promise<void> {
    for (const serviceConfig of this.config) {
      try {
        let service: MCPService;
        
        // Use connection pooling if configured and URL-based
        if (serviceConfig.url && serviceConfig.useConnectionPool) {
          service = new PooledMCPService(
            serviceConfig.name,
            serviceConfig.url,
            serviceConfig.poolConfig
          );
        } else {
          service = new MCPServiceImpl(serviceConfig);
        }
        
        await service.connect();
        this.services.set(serviceConfig.name, service);
        console.log(`Connected to service: ${serviceConfig.name}${serviceConfig.useConnectionPool ? ' (pooled)' : ''}`);
      } catch (error) {
        console.error(`Failed to connect to service ${serviceConfig.name}:`, error);
      }
    }
  }

  getService(name: string): MCPService | undefined {
    return this.services.get(name);
  }

  getAllServices(): MCPService[] {
    return Array.from(this.services.values());
  }

  async shutdown(): Promise<void> {
    for (const service of this.services.values()) {
      await service.disconnect();
    }
    this.services.clear();
  }
}

class MCPServiceImpl implements MCPService {
  private config: ServiceConfig;
  private client?: Client;
  private process?: ChildProcess;
  private connected: boolean = false;

  constructor(config: ServiceConfig) {
    this.config = config;
    this.name = config.name;
  }

  name: string;

  async connect(): Promise<void> {
    if (this.config.url) {
      // Connect to existing service via WebSocket
      const transport = new WebSocketClientTransport(new URL(this.config.url));
      this.client = new Client({
        name: `babayaga-client-${this.config.name}`,
        version: '1.0.0',
      }, {
        capabilities: {}
      });
      await this.client.connect(transport);
    } else if (this.config.command) {
      // Start service as subprocess
      this.process = spawn(this.config.command, this.config.args || [], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args || [],
      });

      this.client = new Client({
        name: `babayaga-client-${this.config.name}`,
        version: '1.0.0',
      }, {
        capabilities: {}
      });

      await this.client.connect(transport);
    } else {
      throw new Error(`Service ${this.config.name} has no connection method specified`);
    }

    this.connected = true;

    // Set up health check if configured
    if (this.config.healthCheckInterval) {
      this.startHealthCheck();
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
    if (this.process) {
      this.process.kill();
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async callTool(toolName: string, args: any): Promise<any> {
    if (!this.client) {
      throw new Error(`Service ${this.name} is not connected`);
    }

    return await this.client.callTool({
      name: toolName,
      arguments: args,
    });
  }

  async getTools(): Promise<Tool[]> {
    if (!this.client) {
      throw new Error(`Service ${this.name} is not connected`);
    }

    const response = await this.client.listTools();
    return response.tools;
  }

  private startHealthCheck(): void {
    setInterval(async () => {
      try {
        if (this.config.healthCheckUrl) {
          const response = await fetch(this.config.healthCheckUrl);
          if (!response.ok) {
            console.warn(`Health check failed for ${this.name}`);
            // Attempt reconnection
            await this.reconnect();
          }
        } else {
          // Simple connectivity check
          await this.getTools();
        }
      } catch (error) {
        console.warn(`Health check error for ${this.name}:`, error);
        await this.reconnect();
      }
    }, this.config.healthCheckInterval || 30000);
  }

  private async reconnect(): Promise<void> {
    try {
      await this.disconnect();
      await this.connect();
      console.log(`Reconnected to service: ${this.name}`);
    } catch (error) {
      console.error(`Failed to reconnect to ${this.name}:`, error);
    }
  }
}