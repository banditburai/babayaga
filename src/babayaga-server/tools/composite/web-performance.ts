import { ToolResponse } from '../../../types/mcp';
import { ServiceDiscovery } from '../../../utils/service-discovery';

export interface WebPerformanceTestParams {
  url: string;
  screenshotName?: string;
  metrics?: string[];
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
}

export class WebPerformanceTest {
  constructor(private serviceDiscovery: ServiceDiscovery) {}
  
  async execute(params: WebPerformanceTestParams): Promise<ToolResponse> {
    const results: any = {
      url: params.url,
      timestamp: new Date().toISOString(),
      tests: {},
    };

    // Navigate to the page first
    const puppeteerService = this.serviceDiscovery.getService('puppeteer');
    if (puppeteerService) {
      try {
        await puppeteerService.callTool('navigate', {
          url: params.url,
          waitUntil: params.waitUntil || 'networkidle0',
        });
        results.tests.navigation = { status: 'success' };
      } catch (error) {
        results.tests.navigation = { 
          status: 'failed', 
          error: String(error) 
        };
      }
    }

    // Take screenshot if requested
    if (puppeteerService && params.screenshotName) {
      try {
        const screenshotResult = await puppeteerService.callTool('screenshot', {
          name: params.screenshotName,
        });
        results.tests.screenshot = { 
          status: 'success',
          result: screenshotResult 
        };
      } catch (error) {
        results.tests.screenshot = { 
          status: 'failed', 
          error: String(error) 
        };
      }
    }

    // Collect metrics if CDP is available
    const cdpService = this.serviceDiscovery.getService('cdp');
    if (cdpService && params.metrics) {
      results.tests.metrics = {};
      
      for (const metric of params.metrics) {
        try {
          switch (metric) {
            case 'performance': {
              // Enable performance domain first
              await cdpService.callTool('cdp_command', {
                method: 'Performance.enable',
              });
              
              const perfResult = await cdpService.callTool('cdp_command', {
                method: 'Performance.getMetrics',
              });
              results.tests.metrics.performance = {
                status: 'success',
                data: perfResult,
              };
              break;
            }
            
            case 'network': {
              // Enable network domain
              await cdpService.callTool('cdp_command', {
                method: 'Network.enable',
              });
              
              // Get resource timing
              const timingResult = await cdpService.callTool('cdp_command', {
                method: 'Performance.getMetrics',
              });
              results.tests.metrics.network = {
                status: 'success',
                data: timingResult,
              };
              break;
            }
            
            case 'console': {
              // Enable console domain
              await cdpService.callTool('cdp_command', {
                method: 'Console.enable',
              });
              
              // Evaluate to get console logs
              const consoleResult = await cdpService.callTool('cdp_command', {
                method: 'Runtime.evaluate',
                params: JSON.stringify({
                  expression: `
                    (() => {
                      const logs = window.__consoleLogs || [];
                      return logs.slice(-50); // Last 50 logs
                    })()
                  `,
                  returnByValue: true,
                }),
              });
              results.tests.metrics.console = {
                status: 'success',
                data: consoleResult,
              };
              break;
            }
            
            case 'coverage': {
              // Start coverage
              await cdpService.callTool('cdp_command', {
                method: 'Profiler.enable',
              });
              await cdpService.callTool('cdp_command', {
                method: 'Profiler.startPreciseCoverage',
                params: JSON.stringify({
                  callCount: true,
                  detailed: true,
                }),
              });
              
              // Wait a bit for coverage data
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Get coverage
              const coverageResult = await cdpService.callTool('cdp_command', {
                method: 'Profiler.takePreciseCoverage',
              });
              
              results.tests.metrics.coverage = {
                status: 'success',
                data: coverageResult,
              };
              
              // Stop coverage
              await cdpService.callTool('cdp_command', {
                method: 'Profiler.stopPreciseCoverage',
              });
              break;
            }
            
            default:
              results.tests.metrics[metric] = {
                status: 'skipped',
                reason: 'Unknown metric type',
              };
          }
        } catch (error) {
          results.tests.metrics[metric] = {
            status: 'failed',
            error: String(error),
          };
        }
      }
    }

    // Calculate summary
    const totalTests = Object.keys(results.tests).length;
    const successfulTests = Object.values(results.tests)
      .filter((test: any) => test.status === 'success').length;
    
    results.summary = {
      totalTests,
      successful: successfulTests,
      failed: totalTests - successfulTests,
      successRate: totalTests > 0 ? (successfulTests / totalTests) * 100 : 0,
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(results, null, 2),
      }],
    };
  }
}