import { Tool } from '@modelcontextprotocol/sdk/types.js';

export interface BabaYagaTool extends Tool {
  service?: 'puppeteer' | 'cdp' | 'composite';
}

export interface ToolRegistry {
  register(tool: BabaYagaTool): void;
  getTools(): BabaYagaTool[];
  getTool(name: string): BabaYagaTool | undefined;
}

export interface ServiceConfig {
  name: string;
  url?: string;
  command?: string;
  args?: string[];
  healthCheckUrl?: string;
  healthCheckInterval?: number;
  useConnectionPool?: boolean;
  poolConfig?: {
    minConnections?: number;
    maxConnections?: number;
    idleTimeout?: number;
    acquireTimeout?: number;
  };
}

export interface MCPService {
  name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  callTool(toolName: string, args: any): Promise<any>;
  getTools(): Promise<Tool[]>;
}

export interface ProxyConfig {
  services: ServiceConfig[];
  retryAttempts?: number;
  retryDelay?: number;
}

export interface ToolResponse {
  content: Array<{
    type: string;
    text?: string;
    [key: string]: any;
  }>;
}

export interface CDPCommandParams {
  method: string;
  params?: string;
}

export interface VisualRegressionParams {
  url: string;
  baselineName: string;
  viewport?: {
    width: number;
    height: number;
  };
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
}