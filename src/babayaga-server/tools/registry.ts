import { BabaYagaTool, ToolRegistry } from '../../types/mcp';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export class ToolRegistryImpl implements ToolRegistry {
  private tools: Map<string, BabaYagaTool> = new Map();
  private toolsByService: Map<string, BabaYagaTool[]> = new Map();

  register(tool: BabaYagaTool): void {
    this.tools.set(tool.name, tool);
    
    if (tool.service) {
      const serviceTools = this.toolsByService.get(tool.service) || [];
      serviceTools.push(tool);
      this.toolsByService.set(tool.service, serviceTools);
    }
  }

  getTools(): BabaYagaTool[] {
    return Array.from(this.tools.values());
  }

  getTool(name: string): BabaYagaTool | undefined {
    return this.tools.get(name);
  }

  getToolsByService(service: string): BabaYagaTool[] {
    return this.toolsByService.get(service) || [];
  }

  clear(): void {
    this.tools.clear();
    this.toolsByService.clear();
  }

  // Import tools from an MCP service
  async importFromService(serviceName: string, tools: Tool[]): Promise<void> {
    for (const tool of tools) {
      // Check if tool name already starts with service prefix to prevent double-prefixing
      const toolName = tool.name.startsWith(`${serviceName}_`) 
        ? tool.name 
        : `${serviceName}_${tool.name}`;
      
      const babaYagaTool: BabaYagaTool = {
        ...tool,
        service: serviceName as any,
        name: toolName,
      };
      this.register(babaYagaTool);
    }
  }

  // Create a composite tool that combines multiple service tools
  createCompositeTools(): BabaYagaTool[] {
    const compositeTools: BabaYagaTool[] = [];

    // Example: Create a comprehensive web test tool
    if (this.tools.has('puppeteer_screenshot') && (this.tools.has('cdp_cdp_command') || this.tools.has('cdp_command'))) {
      compositeTools.push({
        name: 'web_performance_test',
        description: 'Comprehensive web performance test with screenshots and metrics',
        service: 'composite',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to test',
            },
            screenshotName: {
              type: 'string',
              description: 'Name for the screenshot',
            },
            metrics: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['performance', 'network', 'console', 'coverage'],
              },
              description: 'Metrics to collect',
            },
          },
          required: ['url'],
        },
      });
    }

    // Visual regression with performance metrics
    if (this.tools.has('puppeteer_screenshot')) {
      compositeTools.push({
        name: 'visual_regression_with_metrics',
        description: 'Visual regression testing with performance metrics',
        service: 'composite',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to test',
            },
            baselineName: {
              type: 'string',
              description: 'Name for baseline comparison',
            },
            viewport: {
              type: 'object',
              properties: {
                width: { type: 'number' },
                height: { type: 'number' },
              },
              description: 'Viewport dimensions',
            },
          },
          required: ['url', 'baselineName'],
        },
      });
    }

    for (const tool of compositeTools) {
      this.register(tool);
    }

    return compositeTools;
  }
}