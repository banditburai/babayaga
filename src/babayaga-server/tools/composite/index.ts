import { ServiceDiscovery } from '../../../utils/service-discovery';
import { ToolResponse } from '../../../types/mcp';
import { WebPerformanceTest } from './web-performance';

export interface CompositeToolHandler {
  name: string;
  execute(params: any): Promise<ToolResponse>;
}

export class CompositeToolManager {
  private handlers: Map<string, CompositeToolHandler> = new Map();
  
  constructor(private serviceDiscovery: ServiceDiscovery) {
    this.registerDefaultHandlers();
  }
  
  private registerDefaultHandlers() {
    // Web Performance Test
    const webPerfTest = new WebPerformanceTest(this.serviceDiscovery);
    this.handlers.set('web_performance_test', {
      name: 'web_performance_test',
      execute: (params) => webPerfTest.execute(params),
    });
    
    // Visual Regression with Metrics
    this.handlers.set('visual_regression_with_metrics', {
      name: 'visual_regression_with_metrics',
      execute: async (params) => {
        // This will be handled by the existing visual regression tool
        // but could be enhanced here with additional metrics
        return {
          content: [{
            type: 'text',
            text: 'Visual regression with metrics will be handled by the visual regression tool',
          }],
        };
      },
    });
  }
  
  hasHandler(toolName: string): boolean {
    return this.handlers.has(toolName);
  }
  
  async execute(toolName: string, params: any): Promise<ToolResponse> {
    const handler = this.handlers.get(toolName);
    if (!handler) {
      throw new Error(`No handler found for composite tool: ${toolName}`);
    }
    
    return await handler.execute(params);
  }
  
  getHandlers(): string[] {
    return Array.from(this.handlers.keys());
  }
}