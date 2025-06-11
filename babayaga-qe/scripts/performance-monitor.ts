/**
 * Real-time Performance Monitoring for BabayagaQA
 * Tracks performance metrics in production environments
 */

import { EventEmitter } from 'node:events';
import { performance, PerformanceObserver } from 'node:perf_hooks';
import * as os from 'node:os';
import { logger } from '@babayaga/shared';

interface PerformanceMetric {
  timestamp: number;
  metric: string;
  value: number;
  labels?: Record<string, string>;
}

interface PerformanceAlert {
  timestamp: number;
  severity: 'warning' | 'critical';
  metric: string;
  message: string;
  value: number;
  threshold: number;
}

interface MonitorConfig {
  metricsInterval: number; // ms
  alertThresholds: {
    responseTime: {
      warning: number;
      critical: number;
    };
    memoryUsage: {
      warning: number; // MB
      critical: number;
    };
    cpuUsage: {
      warning: number; // percentage
      critical: number;
    };
    errorRate: {
      warning: number; // percentage
      critical: number;
    };
  };
  retentionPeriod: number; // ms
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private operationCounts = new Map<string, { success: number; error: number }>();
  private responseTimeHistogram = new Map<string, number[]>();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private performanceObserver: PerformanceObserver | null = null;
  private startTime = Date.now();
  private lastCpuUsage = process.cpuUsage();

  constructor(private config: MonitorConfig) {
    super();
    this.setupPerformanceObserver();
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.monitoringInterval) {
      return;
    }

    logger.info('Starting performance monitoring', { 
      interval: this.config.metricsInterval 
    });

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.checkThresholds();
      this.cleanupOldData();
    }, this.config.metricsInterval);

    // Emit initial metrics
    this.collectMetrics();
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    logger.info('Stopped performance monitoring');
  }

  /**
   * Record operation timing
   */
  recordOperation(operation: string, duration: number, success: boolean): void {
    // Update operation counts
    const counts = this.operationCounts.get(operation) || { success: 0, error: 0 };
    if (success) {
      counts.success++;
    } else {
      counts.error++;
    }
    this.operationCounts.set(operation, counts);

    // Update response time histogram
    const histogram = this.responseTimeHistogram.get(operation) || [];
    histogram.push(duration);
    if (histogram.length > 1000) {
      histogram.shift(); // Keep last 1000 values
    }
    this.responseTimeHistogram.set(operation, histogram);

    // Record metric
    this.recordMetric(`operation.duration.${operation}`, duration, {
      operation,
      success: String(success),
    });
  }

  /**
   * Get current metrics summary
   */
  getMetricsSummary(): Record<string, any> {
    const memUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;

    const summary: Record<string, any> = {
      uptime: uptime,
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
      },
      operations: {},
      responseTimePercentiles: {},
      recentAlerts: this.alerts.slice(-10),
    };

    // Calculate operation statistics
    for (const [operation, counts] of this.operationCounts) {
      const total = counts.success + counts.error;
      const errorRate = total > 0 ? (counts.error / total) * 100 : 0;
      
      summary.operations[operation] = {
        total,
        success: counts.success,
        error: counts.error,
        errorRate: errorRate.toFixed(2) + '%',
      };

      // Calculate percentiles for response times
      const times = this.responseTimeHistogram.get(operation) || [];
      if (times.length > 0) {
        const sorted = [...times].sort((a, b) => a - b);
        summary.responseTimePercentiles[operation] = {
          p50: this.percentile(sorted, 50),
          p90: this.percentile(sorted, 90),
          p95: this.percentile(sorted, 95),
          p99: this.percentile(sorted, 99),
          max: sorted[sorted.length - 1],
          min: sorted[0],
        };
      }
    }

    return summary;
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    const lines: string[] = [];
    const summary = this.getMetricsSummary();

    // Memory metrics
    lines.push('# HELP babayaga_memory_heap_used_bytes Heap memory used');
    lines.push('# TYPE babayaga_memory_heap_used_bytes gauge');
    lines.push(`babayaga_memory_heap_used_bytes ${summary.memory.heapUsed * 1024 * 1024}`);

    // Operation metrics
    for (const [operation, stats] of Object.entries(summary.operations)) {
      const opStats = stats as any;
      lines.push(`# HELP babayaga_operation_total Total operations`);
      lines.push(`# TYPE babayaga_operation_total counter`);
      lines.push(`babayaga_operation_total{operation="${operation}",status="success"} ${opStats.success}`);
      lines.push(`babayaga_operation_total{operation="${operation}",status="error"} ${opStats.error}`);
    }

    // Response time percentiles
    for (const [operation, percentiles] of Object.entries(summary.responseTimePercentiles)) {
      const p = percentiles as any;
      lines.push(`# HELP babayaga_response_time_seconds Response time percentiles`);
      lines.push(`# TYPE babayaga_response_time_seconds summary`);
      lines.push(`babayaga_response_time_seconds{operation="${operation}",quantile="0.5"} ${p.p50 / 1000}`);
      lines.push(`babayaga_response_time_seconds{operation="${operation}",quantile="0.9"} ${p.p90 / 1000}`);
      lines.push(`babayaga_response_time_seconds{operation="${operation}",quantile="0.95"} ${p.p95 / 1000}`);
      lines.push(`babayaga_response_time_seconds{operation="${operation}",quantile="0.99"} ${p.p99 / 1000}`);
    }

    return lines.join('\n');
  }

  /**
   * Setup performance observer for automatic tracking
   */
  private setupPerformanceObserver(): void {
    this.performanceObserver = new PerformanceObserver((items) => {
      items.getEntries().forEach((entry) => {
        if (entry.entryType === 'measure') {
          this.recordOperation(entry.name, entry.duration, true);
        }
      });
    });

    this.performanceObserver.observe({ entryTypes: ['measure'] });
  }

  /**
   * Collect system metrics
   */
  private collectMetrics(): void {

    // Memory metrics
    const memUsage = process.memoryUsage();
    this.recordMetric('memory.heap.used', memUsage.heapUsed);
    this.recordMetric('memory.heap.total', memUsage.heapTotal);
    this.recordMetric('memory.rss', memUsage.rss);
    this.recordMetric('memory.external', memUsage.external);

    // CPU metrics
    const currentCpuUsage = process.cpuUsage();
    const userCpu = currentCpuUsage.user - this.lastCpuUsage.user;
    const systemCpu = currentCpuUsage.system - this.lastCpuUsage.system;
    const totalCpu = userCpu + systemCpu;
    const cpuPercentage = (totalCpu / (this.config.metricsInterval * 1000)) * 100;
    
    this.recordMetric('cpu.usage.percentage', cpuPercentage);
    this.lastCpuUsage = currentCpuUsage;

    // System metrics
    this.recordMetric('system.load.1min', os.loadavg()[0]);
    this.recordMetric('system.memory.free', os.freemem());
    this.recordMetric('system.memory.total', os.totalmem());

    // Calculate aggregated metrics
    this.calculateAggregatedMetrics();
  }

  /**
   * Calculate aggregated metrics
   */
  private calculateAggregatedMetrics(): void {
    // Calculate overall error rate
    let totalOps = 0;
    let totalErrors = 0;

    for (const counts of this.operationCounts.values()) {
      totalOps += counts.success + counts.error;
      totalErrors += counts.error;
    }

    if (totalOps > 0) {
      const errorRate = (totalErrors / totalOps) * 100;
      this.recordMetric('operations.error_rate', errorRate);
    }

    // Calculate average response time across all operations
    let totalTime = 0;
    let totalSamples = 0;

    for (const times of this.responseTimeHistogram.values()) {
      totalTime += times.reduce((a, b) => a + b, 0);
      totalSamples += times.length;
    }

    if (totalSamples > 0) {
      this.recordMetric('operations.avg_response_time', totalTime / totalSamples);
    }
  }

  /**
   * Check thresholds and emit alerts
   */
  private checkThresholds(): void {
    const memUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;
    const thresholds = this.config.alertThresholds;

    // Check memory usage
    if (memUsageMB > thresholds.memoryUsage.critical) {
      this.emitAlert('critical', 'memory.usage', 
        `Memory usage critically high: ${memUsageMB.toFixed(2)}MB`,
        memUsageMB, thresholds.memoryUsage.critical);
    } else if (memUsageMB > thresholds.memoryUsage.warning) {
      this.emitAlert('warning', 'memory.usage',
        `Memory usage high: ${memUsageMB.toFixed(2)}MB`,
        memUsageMB, thresholds.memoryUsage.warning);
    }

    // Check error rate
    const errorRateMetric = this.metrics
      .filter(m => m.metric === 'operations.error_rate')
      .slice(-1)[0];
    
    if (errorRateMetric) {
      const errorRate = errorRateMetric.value;
      if (errorRate > thresholds.errorRate.critical) {
        this.emitAlert('critical', 'error.rate',
          `Error rate critically high: ${errorRate.toFixed(2)}%`,
          errorRate, thresholds.errorRate.critical);
      } else if (errorRate > thresholds.errorRate.warning) {
        this.emitAlert('warning', 'error.rate',
          `Error rate high: ${errorRate.toFixed(2)}%`,
          errorRate, thresholds.errorRate.warning);
      }
    }

    // Check response times
    for (const [operation, times] of this.responseTimeHistogram) {
      if (times.length > 0) {
        const p95 = this.percentile([...times].sort((a, b) => a - b), 95);
        if (p95 > thresholds.responseTime.critical) {
          this.emitAlert('critical', 'response.time',
            `Response time critically high for ${operation}: ${p95.toFixed(2)}ms`,
            p95, thresholds.responseTime.critical);
        } else if (p95 > thresholds.responseTime.warning) {
          this.emitAlert('warning', 'response.time',
            `Response time high for ${operation}: ${p95.toFixed(2)}ms`,
            p95, thresholds.responseTime.warning);
        }
      }
    }
  }

  /**
   * Emit alert
   */
  private emitAlert(
    severity: 'warning' | 'critical',
    metric: string,
    message: string,
    value: number,
    threshold: number
  ): void {
    const alert: PerformanceAlert = {
      timestamp: Date.now(),
      severity,
      metric,
      message,
      value,
      threshold,
    };

    this.alerts.push(alert);
    this.emit('alert', alert);

    logger.warn('Performance alert triggered', alert);
  }

  /**
   * Record metric
   */
  private recordMetric(
    metric: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    this.metrics.push({
      timestamp: Date.now(),
      metric,
      value,
      labels,
    });
  }

  /**
   * Clean up old data
   */
  private cleanupOldData(): void {
    const cutoffTime = Date.now() - this.config.retentionPeriod;

    // Clean up metrics
    this.metrics = this.metrics.filter(m => m.timestamp > cutoffTime);

    // Clean up alerts
    this.alerts = this.alerts.filter(a => a.timestamp > cutoffTime);
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((sorted.length * p) / 100) - 1;
    return sorted[Math.max(0, index)];
  }
}

// Export default configuration
export const defaultMonitorConfig: MonitorConfig = {
  metricsInterval: 10000, // 10 seconds
  alertThresholds: {
    responseTime: {
      warning: 500,
      critical: 1000,
    },
    memoryUsage: {
      warning: 500,
      critical: 1000,
    },
    cpuUsage: {
      warning: 70,
      critical: 90,
    },
    errorRate: {
      warning: 5,
      critical: 10,
    },
  },
  retentionPeriod: 3600000, // 1 hour
};

// Create global monitor instance
export const monitor = new PerformanceMonitor(defaultMonitorConfig);

// Helper function for timing operations
export function measureOperation<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  
  return fn()
    .then((result) => {
      const duration = performance.now() - start;
      monitor.recordOperation(operation, duration, true);
      return result;
    })
    .catch((error) => {
      const duration = performance.now() - start;
      monitor.recordOperation(operation, duration, false);
      throw error;
    });
}