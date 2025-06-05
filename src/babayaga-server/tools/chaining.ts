import { ToolResponse } from '../../types/mcp';
import { ServiceDiscovery } from '../../utils/service-discovery';
import { TransformerChain } from './transformers';

export interface ChainStep {
  service: string;
  tool: string;
  params: any;
  outputKey?: string; // Key to store output for next steps
  condition?: {
    previousOutput?: string; // Key of previous output to check
    operator: 'equals' | 'contains' | 'exists' | 'notExists';
    value?: any;
  };
}

export interface ChainDefinition {
  name: string;
  description: string;
  steps: ChainStep[];
  finalTransform?: (results: Record<string, any>) => any;
}

export class ToolChainExecutor {
  constructor(
    private serviceDiscovery: ServiceDiscovery,
    private transformers: TransformerChain
  ) {}
  
  async executeChain(chain: ChainDefinition, initialParams: any): Promise<ToolResponse> {
    const results: Record<string, any> = {
      chainName: chain.name,
      startTime: new Date().toISOString(),
      initialParams,
      steps: [],
    };
    
    const stepOutputs: Record<string, any> = {};
    
    for (let i = 0; i < chain.steps.length; i++) {
      const step = chain.steps[i];
      const stepResult: any = {
        index: i,
        service: step.service,
        tool: step.tool,
        startTime: new Date().toISOString(),
      };
      
      try {
        // Check condition if specified
        if (step.condition && !this.evaluateCondition(step.condition, stepOutputs)) {
          stepResult.status = 'skipped';
          stepResult.reason = 'Condition not met';
          results.steps.push(stepResult);
          continue;
        }
        
        // Prepare parameters with variable substitution
        const processedParams = this.processParameters(step.params, stepOutputs);
        stepResult.params = processedParams;
        
        // Get service
        const service = this.serviceDiscovery.getService(step.service);
        if (!service) {
          throw new Error(`Service ${step.service} not available`);
        }
        
        // Execute tool
        // Remove service prefix from tool name (only from the beginning)
        const prefix = `${step.service}_`;
        const originalToolName = step.tool.startsWith(prefix) ? step.tool.substring(prefix.length) : step.tool;
        const toolResponse = await service.callTool(originalToolName, processedParams);
        
        // Apply transformations
        const transformedResponse = await this.transformers.transform({
          toolName: originalToolName,
          serviceName: step.service,
          originalResponse: toolResponse,
          metadata: processedParams,
        });
        
        stepResult.status = 'success';
        stepResult.output = transformedResponse;
        stepResult.endTime = new Date().toISOString();
        
        // Store output if key specified
        if (step.outputKey) {
          stepOutputs[step.outputKey] = this.extractOutput(transformedResponse);
        }
        
      } catch (error) {
        stepResult.status = 'failed';
        stepResult.error = String(error);
        stepResult.endTime = new Date().toISOString();
        
        // Decide whether to continue or abort chain
        if (i < chain.steps.length - 1) {
          console.warn(`Step ${i} failed, continuing chain...`);
        }
      }
      
      results.steps.push(stepResult);
    }
    
    // Calculate summary
    results.endTime = new Date().toISOString();
    results.summary = {
      totalSteps: chain.steps.length,
      successful: results.steps.filter((s: any) => s.status === 'success').length,
      failed: results.steps.filter((s: any) => s.status === 'failed').length,
      skipped: results.steps.filter((s: any) => s.status === 'skipped').length,
    };
    
    // Apply final transformation if specified
    if (chain.finalTransform) {
      results.finalOutput = chain.finalTransform(stepOutputs);
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(results, null, 2),
      }],
    };
  }
  
  private evaluateCondition(condition: any, outputs: Record<string, any>): boolean {
    if (!condition.previousOutput) return true;
    
    const value = outputs[condition.previousOutput];
    
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'exists':
        return value !== undefined && value !== null;
      case 'notExists':
        return value === undefined || value === null;
      default:
        return true;
    }
  }
  
  private processParameters(params: any, outputs: Record<string, any>): any {
    if (typeof params === 'string') {
      // Replace variables like ${stepKey.field}
      return params.replace(/\${([^}]+)}/g, (match, path) => {
        const value = this.getValueByPath(outputs, path);
        return value !== undefined ? String(value) : match;
      });
    }
    
    if (Array.isArray(params)) {
      return params.map(item => this.processParameters(item, outputs));
    }
    
    if (typeof params === 'object' && params !== null) {
      const processed: any = {};
      for (const [key, value] of Object.entries(params)) {
        processed[key] = this.processParameters(value, outputs);
      }
      return processed;
    }
    
    return params;
  }
  
  private getValueByPath(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  }
  
  private extractOutput(response: ToolResponse): any {
    try {
      const text = response.content[0]?.text;
      if (text) {
        return JSON.parse(text);
      }
    } catch {
      return response.content[0]?.text || response;
    }
    return response;
  }
}

// Predefined chains
export const PREDEFINED_CHAINS: ChainDefinition[] = [
  {
    name: 'full_page_analysis',
    description: 'Complete page analysis with performance, accessibility, and SEO checks',
    steps: [
      {
        service: 'puppeteer',
        tool: 'puppeteer_navigate',
        params: { url: '${url}' },
        outputKey: 'navigation',
      },
      {
        service: 'puppeteer',
        tool: 'puppeteer_screenshot',
        params: { name: 'initial-state' },
        outputKey: 'screenshot',
      },
      {
        service: 'cdp',
        tool: 'cdp_command',
        params: {
          method: 'Performance.enable',
        },
      },
      {
        service: 'cdp',
        tool: 'cdp_command',
        params: {
          method: 'Performance.getMetrics',
        },
        outputKey: 'performance',
      },
      {
        service: 'cdp',
        tool: 'cdp_command',
        params: {
          method: 'Accessibility.enable',
        },
      },
      {
        service: 'cdp',
        tool: 'cdp_command',
        params: {
          method: 'Accessibility.getFullAXTree',
        },
        outputKey: 'accessibility',
      },
      {
        service: 'puppeteer',
        tool: 'puppeteer_evaluate',
        params: {
          script: `
            (() => {
              const meta = {};
              document.querySelectorAll('meta').forEach(tag => {
                const name = tag.getAttribute('name') || tag.getAttribute('property');
                if (name) meta[name] = tag.getAttribute('content');
              });
              return {
                title: document.title,
                meta,
                headings: {
                  h1: Array.from(document.querySelectorAll('h1')).map(h => h.textContent),
                  h2: Array.from(document.querySelectorAll('h2')).map(h => h.textContent),
                },
                images: {
                  total: document.images.length,
                  withoutAlt: Array.from(document.images).filter(img => !img.alt).length,
                },
              };
            })()
          `,
        },
        outputKey: 'seo',
      },
    ],
    finalTransform: (outputs) => ({
      performance: outputs.performance,
      accessibility: {
        violations: outputs.accessibility?.violations || [],
      },
      seo: outputs.seo,
      screenshot: outputs.screenshot?.path,
    }),
  },
  {
    name: 'interactive_test_flow',
    description: 'Test interactive elements on a page',
    steps: [
      {
        service: 'puppeteer',
        tool: 'puppeteer_navigate',
        params: { url: '${url}' },
      },
      {
        service: 'puppeteer',
        tool: 'puppeteer_click',
        params: { selector: '${targetSelector}' },
        outputKey: 'clickResult',
      },
      {
        service: 'puppeteer',
        tool: 'puppeteer_wait_for_selector',
        params: { 
          selector: '${expectedSelector}',
          options: { timeout: 5000 },
        },
        condition: {
          previousOutput: 'clickResult',
          operator: 'exists',
        },
      },
      {
        service: 'puppeteer',
        tool: 'puppeteer_screenshot',
        params: { name: 'after-interaction' },
        outputKey: 'finalScreenshot',
      },
    ],
  },
];