import { CDPClient } from './cdp-client.js';
import { normalizeError } from './utils.js';

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    cdpConnection: HealthCheck;
    targetAvailability: HealthCheck;
    browserResponsiveness: HealthCheck;
    systemResources: HealthCheck;
  };
  metrics: {
    uptime: number;
    totalCommands: number;
    failedCommands: number;
    averageResponseTime: number;
    lastSuccessfulCommand?: string;
  };
}

export interface HealthCheck {
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: any;
  duration?: number;
}

export class HealthChecker {
  private startTime = Date.now();
  private commandMetrics = {
    total: 0,
    failed: 0,
    responseTimes: [] as number[],
    lastSuccess: null as string | null
  };

  constructor(
    private cdpClient: CDPClient | null,
    private cdpUrl: string
  ) {}

  recordCommand(_method: string, success: boolean, responseTime: number): void {
    this.commandMetrics.total++;
    if (!success) {
      this.commandMetrics.failed++;
    } else {
      this.commandMetrics.lastSuccess = new Date().toISOString();
    }
    
    this.commandMetrics.responseTimes.push(responseTime);
    // Keep only last 100 response times for average calculation
    if (this.commandMetrics.responseTimes.length > 100) {
      this.commandMetrics.responseTimes.shift();
    }
  }

  async performHealthCheck(): Promise<HealthStatus> {
    const checks = {
      cdpConnection: await this.checkCDPConnection(),
      targetAvailability: await this.checkTargetAvailability(),
      browserResponsiveness: await this.checkBrowserResponsiveness(),
      systemResources: await this.checkSystemResources(),
    };

    const overall = this.determineOverallHealth(checks);
    
    return {
      overall,
      timestamp: new Date().toISOString(),
      checks,
      metrics: {
        uptime: Date.now() - this.startTime,
        totalCommands: this.commandMetrics.total,
        failedCommands: this.commandMetrics.failed,
        averageResponseTime: this.calculateAverageResponseTime(),
        lastSuccessfulCommand: this.commandMetrics.lastSuccess || undefined
      }
    };
  }

  private async checkCDPConnection(): Promise<HealthCheck> {
    const start = Date.now();
    
    if (!this.cdpClient) {
      return {
        status: 'fail',
        message: 'No CDP client instance',
        duration: Date.now() - start
      };
    }

    if (!this.cdpClient.connected) {
      return {
        status: 'fail',
        message: 'CDP client not connected',
        duration: Date.now() - start
      };
    }

    return {
      status: 'pass',
      message: 'CDP connection active',
      duration: Date.now() - start
    };
  }

  private async checkTargetAvailability(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      const targets = await CDPClient.getPageTargets(this.cdpUrl);
      
      if (targets.length === 0) {
        return {
          status: 'warn',
          message: 'No page targets available',
          details: { targetCount: 0 },
          duration: Date.now() - start
        };
      }

      return {
        status: 'pass',
        message: `${targets.length} target(s) available`,
        details: { 
          targetCount: targets.length,
          targets: targets.map(t => ({ id: t.id, title: t.title, url: t.url }))
        },
        duration: Date.now() - start
      };
    } catch (error) {
      return {
        status: 'fail',
        message: `Failed to fetch targets: ${normalizeError(error)}`,
        duration: Date.now() - start
      };
    }
  }

  private async checkBrowserResponsiveness(): Promise<HealthCheck> {
    const start = Date.now();
    
    if (!this.cdpClient?.connected) {
      return {
        status: 'fail',
        message: 'Cannot test responsiveness - not connected',
        duration: Date.now() - start
      };
    }

    try {
      // Simple ping command
      await this.cdpClient.sendCommand('Runtime.evaluate', {
        expression: '1 + 1',
        returnByValue: true
      });

      const responseTime = Date.now() - start;
      const status = responseTime < 1000 ? 'pass' : responseTime < 3000 ? 'warn' : 'fail';
      
      return {
        status,
        message: `Browser responded in ${responseTime}ms`,
        details: { responseTime },
        duration: responseTime
      };
    } catch (error) {
      return {
        status: 'fail',
        message: `Browser unresponsive: ${normalizeError(error)}`,
        duration: Date.now() - start
      };
    }
  }

  private async checkSystemResources(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Simple heuristics for resource health
      const memoryMB = memUsage.heapUsed / 1024 / 1024;
      const memoryStatus = memoryMB < 100 ? 'pass' : memoryMB < 500 ? 'warn' : 'fail';
      
      return {
        status: memoryStatus,
        message: `Memory usage: ${memoryMB.toFixed(1)}MB`,
        details: {
          memory: {
            heapUsed: memoryMB,
            heapTotal: memUsage.heapTotal / 1024 / 1024,
            external: memUsage.external / 1024 / 1024
          },
          cpu: cpuUsage
        },
        duration: Date.now() - start
      };
    } catch (error) {
      return {
        status: 'fail',
        message: `Failed to check system resources: ${normalizeError(error)}`,
        duration: Date.now() - start
      };
    }
  }

  private determineOverallHealth(checks: Record<string, HealthCheck>): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(checks).map(check => check.status);
    
    if (statuses.includes('fail')) {
      return 'unhealthy';
    }
    if (statuses.includes('warn')) {
      return 'degraded';
    }
    return 'healthy';
  }

  private calculateAverageResponseTime(): number {
    if (this.commandMetrics.responseTimes.length === 0) return 0;
    
    const sum = this.commandMetrics.responseTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.commandMetrics.responseTimes.length);
  }

  updateClient(cdpClient: CDPClient | null): void {
    this.cdpClient = cdpClient;
  }
}