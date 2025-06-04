export interface CDPClient {
  send(method: string, params?: any): Promise<any>;
  on(event: string, listener: (params: any) => void): void;
  close(): Promise<void>;
}

export interface CDPSession {
  id: string;
  targetId: string;
  client: CDPClient;
}

export interface CDPServerConfig {
  port: number;
  host?: string;
  chromePath?: string;
  chromePort?: number;
}

export interface ChromeTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  description?: string;
  webSocketDebuggerUrl?: string;
}