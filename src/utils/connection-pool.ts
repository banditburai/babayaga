import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js';

export interface PooledConnection {
  id: string;
  client: Client;
  inUse: boolean;
  lastUsed: Date;
  created: Date;
  url: string;
}

export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  idleTimeout: number; // milliseconds
  acquireTimeout: number; // milliseconds
  createRetries: number;
  createRetryDelay: number; // milliseconds
}

export class ConnectionPool {
  private connections: Map<string, PooledConnection> = new Map();
  private waitQueue: Array<{
    resolve: (conn: PooledConnection) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];
  
  private config: ConnectionPoolConfig;
  private url: string;
  private serviceName: string;
  private cleanupInterval?: NodeJS.Timeout;
  
  constructor(serviceName: string, url: string, config?: Partial<ConnectionPoolConfig>) {
    this.serviceName = serviceName;
    this.url = url;
    this.config = {
      minConnections: 1,
      maxConnections: 5,
      idleTimeout: 5 * 60 * 1000, // 5 minutes
      acquireTimeout: 10 * 1000, // 10 seconds
      createRetries: 3,
      createRetryDelay: 1000, // 1 second
      ...config,
    };
    
    this.startCleanup();
  }
  
  async initialize(): Promise<void> {
    // Create minimum connections
    const promises: Promise<void>[] = [];
    for (let i = 0; i < this.config.minConnections; i++) {
      promises.push(this.createConnection());
    }
    await Promise.all(promises);
  }
  
  async acquire(): Promise<PooledConnection> {
    // Try to find an available connection
    for (const conn of this.connections.values()) {
      if (!conn.inUse) {
        conn.inUse = true;
        conn.lastUsed = new Date();
        return conn;
      }
    }
    
    // Create new connection if pool not full
    if (this.connections.size < this.config.maxConnections) {
      await this.createConnection();
      return this.acquire(); // Recursive call to get the newly created connection
    }
    
    // Wait for a connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitQueue.findIndex(item => item.timeout === timeout);
        if (index !== -1) {
          this.waitQueue.splice(index, 1);
        }
        reject(new Error(`Timeout acquiring connection after ${this.config.acquireTimeout}ms`));
      }, this.config.acquireTimeout);
      
      this.waitQueue.push({ resolve, reject, timeout });
    });
  }
  
  release(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      console.warn(`Connection ${connectionId} not found in pool`);
      return;
    }
    
    conn.inUse = false;
    conn.lastUsed = new Date();
    
    // Check if anyone is waiting for a connection
    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift();
      if (waiter) {
        clearTimeout(waiter.timeout);
        conn.inUse = true;
        conn.lastUsed = new Date();
        waiter.resolve(conn);
      }
    }
  }
  
  async destroy(connectionId: string): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (!conn) return;
    
    try {
      await conn.client.close();
    } catch (error) {
      console.error(`Error closing connection ${connectionId}:`, error);
    }
    
    this.connections.delete(connectionId);
    
    // Ensure minimum connections
    if (this.connections.size < this.config.minConnections) {
      this.createConnection().catch(console.error);
    }
  }
  
  private async createConnection(): Promise<void> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < this.config.createRetries; attempt++) {
      try {
        const transport = new WebSocketClientTransport(new URL(this.url));
        const client = new Client({
          name: `${this.serviceName}-pool-${Date.now()}`,
          version: '1.0.0',
        }, {
          capabilities: {}
        });
        
        await client.connect(transport);
        
        const connection: PooledConnection = {
          id: `${this.serviceName}-${Date.now()}-${Math.random()}`,
          client,
          inUse: false,
          lastUsed: new Date(),
          created: new Date(),
          url: this.url,
        };
        
        this.connections.set(connection.id, connection);
        return;
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.config.createRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, this.config.createRetryDelay));
        }
      }
    }
    
    throw lastError || new Error('Failed to create connection');
  }
  
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const connectionsToRemove: string[] = [];
      
      for (const [id, conn] of this.connections) {
        // Skip connections in use or minimum connections
        if (conn.inUse || this.connections.size <= this.config.minConnections) {
          continue;
        }
        
        // Remove idle connections
        const idleTime = now - conn.lastUsed.getTime();
        if (idleTime > this.config.idleTimeout) {
          connectionsToRemove.push(id);
        }
      }
      
      // Remove idle connections
      for (const id of connectionsToRemove) {
        this.destroy(id).catch(console.error);
      }
    }, 30000); // Run cleanup every 30 seconds
  }
  
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Reject all waiting requests
    for (const waiter of this.waitQueue) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error('Connection pool shutting down'));
    }
    this.waitQueue = [];
    
    // Close all connections
    const promises: Promise<void>[] = [];
    for (const id of this.connections.keys()) {
      promises.push(this.destroy(id));
    }
    await Promise.all(promises);
  }
  
  getStats() {
    const connections = Array.from(this.connections.values());
    return {
      total: connections.length,
      inUse: connections.filter(c => c.inUse).length,
      idle: connections.filter(c => !c.inUse).length,
      waitQueueLength: this.waitQueue.length,
      config: this.config,
    };
  }
}

// Enhanced service implementation with connection pooling
export class PooledMCPService {
  private pool: ConnectionPool;
  
  constructor(
    public name: string,
    url: string,
    poolConfig?: Partial<ConnectionPoolConfig>
  ) {
    this.pool = new ConnectionPool(name, url, poolConfig);
  }
  
  async connect(): Promise<void> {
    await this.pool.initialize();
  }
  
  async disconnect(): Promise<void> {
    await this.pool.shutdown();
  }
  
  isConnected(): boolean {
    return this.pool.getStats().total > 0;
  }
  
  async callTool(toolName: string, args: any): Promise<any> {
    const conn = await this.pool.acquire();
    try {
      return await conn.client.callTool({
        name: toolName,
        arguments: args,
      });
    } finally {
      this.pool.release(conn.id);
    }
  }
  
  async getTools(): Promise<any[]> {
    const conn = await this.pool.acquire();
    try {
      const response = await conn.client.listTools();
      return response.tools;
    } finally {
      this.pool.release(conn.id);
    }
  }
  
  getPoolStats() {
    return this.pool.getStats();
  }
}