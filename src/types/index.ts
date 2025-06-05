import { Browser, Page, Viewport } from 'puppeteer';

export interface BabaYagaConfig {
  // Browser settings
  headless?: boolean;
  browserArgs?: string[];
  defaultViewport?: Viewport | null;
  
  // Tool settings
  screenshotPath?: string;
  enablePerformanceTools?: boolean;
  
  // MCP settings
  serverName?: string;
  serverVersion?: string;
}

export interface ToolContext {
  page: Page;
  browser: Browser;
  config: BabaYagaConfig;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: any, context: ToolContext) => Promise<any>;
}

export interface ToolRegistry {
  register(tool: Tool): void;
  get(name: string): Tool | undefined;
  list(): Tool[];
}