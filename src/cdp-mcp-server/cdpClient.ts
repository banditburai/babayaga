import CDP from 'chrome-remote-interface';
import { CDPClient, ChromeTarget } from './types.js';

export class ChromeDevToolsClient {
  private client: any;
  private host: string;
  private port: number;

  constructor(host = 'localhost', port = 9222) {
    this.host = host;
    this.port = port;
  }

  async connect(targetId?: string): Promise<CDPClient> {
    try {
      this.client = await CDP({
        host: this.host,
        port: this.port,
        target: targetId,
      });

      return {
        send: async (method: string, params?: any) => {
          const parts = method.split('.');
          let obj = this.client;
          
          for (let i = 0; i < parts.length - 1; i++) {
            obj = obj[parts[i]];
          }
          
          return obj[parts[parts.length - 1]](params);
        },
        on: (event: string, listener: (params: any) => void) => {
          this.client.on(event, listener);
        },
        close: async () => {
          await this.client.close();
        },
      };
    } catch (error) {
      throw new Error(`Failed to connect to Chrome DevTools: ${error}`);
    }
  }

  async listTargets(): Promise<ChromeTarget[]> {
    try {
      const response = await fetch(`http://${this.host}:${this.port}/json/list`);
      return await response.json() as ChromeTarget[];
    } catch (error) {
      throw new Error(`Failed to list Chrome targets: ${error}`);
    }
  }

  async getVersion(): Promise<any> {
    try {
      const response = await fetch(`http://${this.host}:${this.port}/json/version`);
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to get Chrome version: ${error}`);
    }
  }
}