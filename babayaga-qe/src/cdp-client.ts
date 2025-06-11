import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { CDPCommand, CDPResponse, CDPEvent, CDPTarget, CDPTargetSchema } from './types.js';
import { CDPConnectionError, normalizeError } from './utils.js';
import { logger } from '@babayaga/shared';

export interface CDPClientOptions {
  connectionTimeout?: number;
  commandTimeout?: number;
}

export class CDPClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private messageId = 1;
  private callbacks = new Map<
    number,
    {
      resolve: (value: CDPResponse) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();
  private url: string;
  private connectionTimeout: number;
  private commandTimeout: number;
  private isConnecting = false;
  private isConnected = false;

  constructor(webSocketUrl: string, options: CDPClientOptions = {}) {
    super();
    this.url = webSocketUrl;
    this.connectionTimeout = options.connectionTimeout ?? 10000;
    this.commandTimeout = options.commandTimeout ?? 30000;
  }

  get connected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  async connect(): Promise<void> {
    if (this.isConnecting) {
      throw new Error('Connection already in progress');
    }
    
    if (this.connected) {
      return;
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      logger.debug('Connecting to CDP WebSocket', { url: this.url });
      const timeoutId = setTimeout(() => {
        this.isConnecting = false;
        this.cleanup();
        const error = new CDPConnectionError(`Connection timeout after ${this.connectionTimeout}ms`);
        logger.error('CDP connection timeout', { url: this.url }, error);
        reject(error);
      }, this.connectionTimeout);

      try {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          clearTimeout(timeoutId);
          this.isConnecting = false;
          this.isConnected = true;
          logger.info('CDP WebSocket connected', { url: this.url });
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            
            // Handle command response
            if (typeof message.id === 'number') {
              const callback = this.callbacks.get(message.id);
              if (callback) {
                clearTimeout(callback.timeout);
                this.callbacks.delete(message.id);
                callback.resolve(message as CDPResponse);
              }
            }
            // Handle CDP event
            else if (typeof message.method === 'string' && message.params !== undefined) {
              const event = message as CDPEvent;
              this.emit('event', event);
              this.emit(`event:${event.method}`, event.params);
            }
          } catch (error) {
            const message = `Failed to parse CDP message: ${normalizeError(error)}`;
            logger.error(message, { url: this.url }, error as Error);
            this.emit('error', new Error(message));
          }
        });

        this.ws.on('close', (code, reason) => {
          clearTimeout(timeoutId);
          this.isConnecting = false;
          this.isConnected = false;
          logger.warn('CDP WebSocket closed', { url: this.url, code, reason: reason.toString() });
          this.emit('disconnected', { code, reason: reason.toString() });
          this.cleanup();
        });

        this.ws.on('error', (err: Error) => {
          clearTimeout(timeoutId);
          this.isConnecting = false;
          this.isConnected = false;
          logger.error('CDP WebSocket error', { url: this.url }, err);
          this.emit('error', err);
          if (!this.connected) {
            reject(new CDPConnectionError('WebSocket connection failed', err));
          }
        });

      } catch (error) {
        clearTimeout(timeoutId);
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  async sendCommand(method: string, params?: any): Promise<CDPResponse> {
    if (!this.connected) {
      throw new Error('WebSocket is not connected');
    }

    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      
      const timeout = setTimeout(() => {
        this.callbacks.delete(id);
        const error = new Error(`Command '${method}' timed out after ${this.commandTimeout}ms`);
        logger.error('CDP command timeout', { method, params, id }, error);
        reject(error);
      }, this.commandTimeout);

      this.callbacks.set(id, { resolve, reject, timeout });

      const command: CDPCommand = { id, method, params };
      
      try {
        const startTime = Date.now();
        this.ws!.send(JSON.stringify(command), (error) => {
          if (error) {
            clearTimeout(timeout);
            this.callbacks.delete(id);
            const sendError = new Error(`Failed to send command: ${error.message}`);
            logger.error('Failed to send CDP command', { method, params, id }, sendError);
            reject(sendError);
          }
        });
        
        logger.debug('Sent CDP command', { method, params, id });
        this.emit('command', { method, params, startTime });
      } catch (error) {
        clearTimeout(timeout);
        this.callbacks.delete(id);
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
    this.cleanup();
  }

  private cleanup(): void {
    // Clear all pending callbacks
    for (const callback of this.callbacks.values()) {
      clearTimeout(callback.timeout);
      callback.reject(new Error('Connection closed'));
    }
    this.callbacks.clear();
    
    this.ws = null;
    this.isConnected = false;
    this.messageId = 1;
  }

  static async getTargets(cdpUrl: string): Promise<CDPTarget[]> {
    try {
      // Ensure we're fetching from the /json endpoint
      const targetUrl = cdpUrl.endsWith('/json') ? cdpUrl : `${cdpUrl}/json`;
      logger.debug('Fetching CDP targets', { cdpUrl: targetUrl });
      const response = await fetch(targetUrl);
      if (!response.ok) {
        throw new CDPConnectionError(`Failed to fetch targets: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        logger.warn('CDP targets response is not an array', { data });
        return [];
      }

      // Use reduce with safeParse for better performance
      const validTargets = data.reduce<CDPTarget[]>((targets, target) => {
        const parsed = CDPTargetSchema.safeParse(target);
        if (parsed.success) {
          targets.push(parsed.data);
        } else {
          logger.debug('Invalid target format', { target, error: parsed.error });
        }
        return targets;
      }, []);

      logger.info('Successfully fetched CDP targets', { count: validTargets.length });
      return validTargets;
    } catch (error) {
      const message = `Failed to get CDP targets: ${normalizeError(error)}`;
      logger.error(message, { cdpUrl }, error as Error);
      throw new CDPConnectionError(message, error);
    }
  }

  static async getPageTargets(cdpUrl: string): Promise<CDPTarget[]> {
    const targets = await this.getTargets(cdpUrl);
    return targets.filter(target => target.type === 'page');
  }
}