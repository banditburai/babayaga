declare module 'chrome-remote-interface' {
  interface CDPOptions {
    host?: string;
    port?: number;
    target?: string | ((targets: Target[]) => Target | number);
    protocol?: object;
  }

  interface Target {
    id: string;
    type: string;
    title: string;
    url: string;
    description?: string;
    webSocketDebuggerUrl?: string;
  }

  interface CDPClient {
    [domain: string]: {
      [method: string]: (params?: any) => Promise<any>;
    };
    
    on(event: string, callback: (params: any) => void): void;
    once(event: string, callback: (params: any) => void): void;
    off(event: string, callback: (params: any) => void): void;
    
    close(): Promise<void>;
  }

  function CDP(options?: CDPOptions): Promise<CDPClient>;
  
  namespace CDP {
    function List(options?: { host?: string; port?: number }): Promise<Target[]>;
    function Version(options?: { host?: string; port?: number }): Promise<any>;
  }

  export = CDP;
}