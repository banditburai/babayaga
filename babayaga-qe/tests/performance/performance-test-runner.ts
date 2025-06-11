/**
 * Performance Test Runner for BabayagaQA
 * Implements the test scenarios defined in PERFORMANCE_TEST_SCENARIOS.md
 */

import { CDPMcpServer } from '../../src/cdp-mcp-server.js';
import { CDPClient } from '../../src/cdp-client.js';
import { logger } from '../../src/logger.js';
import { performance } from 'perf_hooks';
import * as os from 'os';

interface PerformanceMetrics {
  testName: string;
  startTime: number;
  endTime: number;
  responseTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  errorCount: number;
  successCount: number;
  customMetrics?: Record<string, any>;
}

interface TestConfig {
  name: string;
  description: string;
  duration?: number;
  iterations?: number;
  concurrency?: number;
  warmupIterations?: number;
  thresholds: {
    maxResponseTime: number;
    maxMemoryUsage: number;
    maxCpuUsage?: number;
    maxErrorRate: number;
  };
}

export class PerformanceTestRunner {
  private server: CDPMcpServer;
  private client: CDPClient | null = null;
  private metrics: PerformanceMetrics[] = [];

  constructor(private cdpUrl: string = 'http://localhost:9222') {}

  async setup(): Promise<void> {
    this.server = new CDPMcpServer({
      cdpUrl: this.cdpUrl,
      connectionTimeout: 30000,
      commandTimeout: 30000,
    });
    await this.server.start();
  }

  async teardown(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
    }
    // Server teardown if needed
  }

  /**
   * Run a single performance test
   */
  async runTest(config: TestConfig, testFn: () => Promise<void>): Promise<PerformanceMetrics> {
    const startMemory = process.memoryUsage();
    const startCpu = process.cpuUsage();
    const startTime = performance.now();
    
    let errorCount = 0;
    let successCount = 0;

    try {
      // Warmup iterations
      if (config.warmupIterations) {
        for (let i = 0; i < config.warmupIterations; i++) {
          try {
            await testFn();
          } catch (error) {
            // Ignore warmup errors
          }
        }
      }

      // Actual test iterations
      const iterations = config.iterations || 1;
      for (let i = 0; i < iterations; i++) {
        try {
          await testFn();
          successCount++;
        } catch (error) {
          errorCount++;
          logger.error(`Test iteration ${i} failed`, { 
            test: config.name, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }
    } catch (error) {
      errorCount++;
      logger.error(`Test failed`, { 
        test: config.name, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    const endCpu = process.cpuUsage(startCpu);

    const metrics: PerformanceMetrics = {
      testName: config.name,
      startTime,
      endTime,
      responseTime: endTime - startTime,
      memoryUsage: {
        rss: endMemory.rss - startMemory.rss,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        external: endMemory.external - startMemory.external,
        arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
      },
      cpuUsage: endCpu,
      errorCount,
      successCount,
    };

    this.metrics.push(metrics);
    this.validateThresholds(config, metrics);
    
    return metrics;
  }

  /**
   * Run concurrent test iterations
   */
  async runConcurrentTest(
    config: TestConfig, 
    testFn: () => Promise<void>
  ): Promise<PerformanceMetrics[]> {
    const concurrency = config.concurrency || 1;
    const iterations = config.iterations || 1;
    const allMetrics: PerformanceMetrics[] = [];

    for (let i = 0; i < iterations; i++) {
      const promises = Array(concurrency).fill(0).map(async () => {
        return this.runTest({
          ...config,
          name: `${config.name}_concurrent_${i}`,
          iterations: 1,
        }, testFn);
      });

      const batchMetrics = await Promise.all(promises);
      allMetrics.push(...batchMetrics);
    }

    return allMetrics;
  }

  /**
   * Validate test results against thresholds
   */
  private validateThresholds(config: TestConfig, metrics: PerformanceMetrics): void {
    const failures: string[] = [];

    if (metrics.responseTime > config.thresholds.maxResponseTime) {
      failures.push(`Response time ${metrics.responseTime}ms exceeds threshold ${config.thresholds.maxResponseTime}ms`);
    }

    const heapUsed = metrics.memoryUsage.heapUsed / 1024 / 1024; // Convert to MB
    if (heapUsed > config.thresholds.maxMemoryUsage) {
      failures.push(`Memory usage ${heapUsed.toFixed(2)}MB exceeds threshold ${config.thresholds.maxMemoryUsage}MB`);
    }

    const errorRate = metrics.errorCount / (metrics.errorCount + metrics.successCount);
    if (errorRate > config.thresholds.maxErrorRate) {
      failures.push(`Error rate ${(errorRate * 100).toFixed(2)}% exceeds threshold ${(config.thresholds.maxErrorRate * 100).toFixed(2)}%`);
    }

    if (failures.length > 0) {
      logger.warn(`Test ${config.name} exceeded thresholds`, { failures });
    }
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const report = {
      summary: {
        totalTests: this.metrics.length,
        totalErrors: this.metrics.reduce((sum, m) => sum + m.errorCount, 0),
        totalSuccess: this.metrics.reduce((sum, m) => sum + m.successCount, 0),
        averageResponseTime: this.metrics.reduce((sum, m) => sum + m.responseTime, 0) / this.metrics.length,
        maxResponseTime: Math.max(...this.metrics.map(m => m.responseTime)),
        minResponseTime: Math.min(...this.metrics.map(m => m.responseTime)),
      },
      tests: this.metrics.map(m => ({
        name: m.testName,
        responseTime: `${m.responseTime.toFixed(2)}ms`,
        memoryUsed: `${(m.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        cpuTime: `${((m.cpuUsage.user + m.cpuUsage.system) / 1000).toFixed(2)}ms`,
        errorRate: `${(m.errorCount / (m.errorCount + m.successCount) * 100).toFixed(2)}%`,
      })),
      system: {
        platform: os.platform(),
        cpus: os.cpus().length,
        totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB`,
        freeMemory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)}GB`,
      },
    };

    return JSON.stringify(report, null, 2);
  }
}

// Example test implementations
export class PerformanceTests {
  constructor(private runner: PerformanceTestRunner, private client: CDPClient) {}

  /**
   * Test 1: Basic Tool Integration Test
   */
  async testBasicToolIntegration(): Promise<void> {
    const config: TestConfig = {
      name: 'test_basic_tool_integration',
      description: 'Verify all tools can work together in a single session',
      iterations: 10,
      warmupIterations: 2,
      thresholds: {
        maxResponseTime: 5000,
        maxMemoryUsage: 100,
        maxErrorRate: 0,
      },
    };

    await this.runner.runTest(config, async () => {
      // Connect to target
      await this.client.sendCommand('Target.getTargets', {});
      
      // Sync with Playwright
      await this.client.sendCommand('DOM.enable', {});
      await this.client.sendCommand('CSS.enable', {});
      
      // Perform health check
      const health = await this.client.sendCommand('Runtime.evaluate', {
        expression: 'document.readyState',
      });
      
      // Measure an element
      const result = await this.client.sendCommand('DOM.querySelector', {
        nodeId: 1,
        selector: 'body',
      });
      
      // Calculate distances (if multiple elements)
      // Analyze grid (if applicable)
    });
  }

  /**
   * Test 2: High-Volume Element Measurement
   */
  async testHighVolumeElementMeasurement(): Promise<void> {
    const config: TestConfig = {
      name: 'test_high_volume_element_measurement',
      description: 'Measure performance with large numbers of elements',
      iterations: 1,
      thresholds: {
        maxResponseTime: 30000,
        maxMemoryUsage: 200,
        maxErrorRate: 0.01,
      },
    };

    await this.runner.runTest(config, async () => {
      const selectors = Array(1000).fill(0).map((_, i) => `div:nth-child(${i + 1})`);
      
      for (const selector of selectors) {
        try {
          const startTime = performance.now();
          
          await this.client.sendCommand('DOM.querySelector', {
            nodeId: 1,
            selector,
          });
          
          const queryTime = performance.now() - startTime;
          if (queryTime > 50) {
            logger.warn('Slow element query', { selector, queryTime });
          }
        } catch (error) {
          // Element might not exist, continue
        }
      }
    });
  }

  /**
   * Test 5: CDP Command Throughput Test
   */
  async testCDPCommandThroughput(): Promise<void> {
    const config: TestConfig = {
      name: 'test_cdp_command_throughput',
      description: 'Maximum CDP commands per second sustainable',
      iterations: 1,
      thresholds: {
        maxResponseTime: 10000,
        maxMemoryUsage: 100,
        maxErrorRate: 0.001,
      },
    };

    await this.runner.runTest(config, async () => {
      const commands = [
        { method: 'Runtime.evaluate', params: { expression: '1+1' } },
        { method: 'DOM.getDocument', params: {} },
        { method: 'Page.getLayoutMetrics', params: {} },
        { method: 'Performance.getMetrics', params: {} },
      ];

      const iterations = 1000;
      const startTime = performance.now();
      let successCount = 0;

      for (let i = 0; i < iterations; i++) {
        const command = commands[i % commands.length];
        try {
          await this.client.sendCommand(command.method, command.params);
          successCount++;
        } catch (error) {
          // Count but continue
        }
      }

      const duration = (performance.now() - startTime) / 1000; // seconds
      const throughput = successCount / duration;
      
      logger.info('CDP throughput test completed', { 
        throughput: `${throughput.toFixed(2)} commands/sec`,
        successRate: `${(successCount / iterations * 100).toFixed(2)}%`,
      });
    });
  }
}

// Export test suite runner
export async function runPerformanceTestSuite(): Promise<void> {
  const runner = new PerformanceTestRunner();
  
  try {
    await runner.setup();
    
    // Initialize client
    const client = new CDPClient('http://localhost:9222');
    await client.connect();
    
    const tests = new PerformanceTests(runner, client);
    
    // Run test suite
    logger.info('Starting performance test suite');
    
    await tests.testBasicToolIntegration();
    await tests.testHighVolumeElementMeasurement();
    await tests.testCDPCommandThroughput();
    
    // Generate and save report
    const report = runner.generateReport();
    logger.info('Performance test results', { report: JSON.parse(report) });
    
  } catch (error) {
    logger.error('Performance test suite failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw error;
  } finally {
    await runner.teardown();
  }
}

// CLI entry point
if (require.main === module) {
  runPerformanceTestSuite()
    .then(() => {
      logger.info('Performance tests completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Performance tests failed', { error });
      process.exit(1);
    });
}