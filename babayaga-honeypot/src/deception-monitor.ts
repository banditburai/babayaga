/**
 * Real-time Deception Detection Monitor
 * 
 * Continuously monitors agent behavior for signs of deception,
 * implementing advanced pattern recognition and statistical analysis.
 */

import { EventEmitter } from 'events';
import { BehavioralVerificationEngine, MeasurementEvent, DeceptionIndicator } from './behavioral-verification.js';
import { logger } from '@babayaga/shared';

export interface DeceptionAlert {
  agentId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  pattern: string;
  confidence: number;
  evidence: any[];
  timestamp: Date;
  recommendedAction: string;
}

export interface StatisticalAnomaly {
  metric: string;
  expectedRange: [number, number];
  actualValue: number;
  zScore: number;
  pValue: number;
}

export interface TemporalPattern {
  name: string;
  frequency: 'periodic' | 'sporadic' | 'increasing' | 'decreasing';
  timeWindows: number[];
  correlation: number;
}

/**
 * Advanced Deception Detection Monitor
 * 
 * Uses statistical analysis, machine learning patterns, and temporal
 * behavior analysis to detect sophisticated deception attempts.
 */
export class DeceptionMonitor extends EventEmitter {
  private behavioralEngine: BehavioralVerificationEngine;
  private eventHistory = new Map<string, MeasurementEvent[]>();
  private baselineMetrics = new Map<string, BaselineMetrics>();
  private suspiciousPatterns = new Map<string, SuspiciousPattern[]>();
  
  private readonly DETECTION_WINDOW = 60000; // 1 minute
  private readonly BASELINE_PERIOD = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_HISTORY_SIZE = 1000;

  constructor() {
    super();
    this.behavioralEngine = new BehavioralVerificationEngine();
    this.startContinuousMonitoring();
  }

  /**
   * Process new measurement event and check for deception indicators
   */
  async processEvent(event: MeasurementEvent): Promise<void> {
    // Store event in history
    this.addToHistory(event);
    
    // Update baseline metrics
    this.updateBaseline(event);
    
    // Perform real-time analysis
    const alerts = await this.analyzeForDeception(event);
    
    // Emit alerts if any detected
    for (const alert of alerts) {
      this.emit('deceptionAlert', alert);
      logger.warn('Deception alert triggered', alert);
    }
  }

  /**
   * Advanced statistical analysis for deception detection
   */
  private async analyzeForDeception(event: MeasurementEvent): Promise<DeceptionAlert[]> {
    const alerts: DeceptionAlert[] = [];
    const agentHistory = this.eventHistory.get(event.agentId) || [];
    
    // 1. Timing Pattern Analysis
    const timingAlert = this.analyzeTimingPatterns(event, agentHistory);
    if (timingAlert) alerts.push(timingAlert);
    
    // 2. Statistical Anomaly Detection
    const statAlert = this.detectStatisticalAnomalies(event, agentHistory);
    if (statAlert) alerts.push(statAlert);
    
    // 3. Consistency Violation Detection
    const consistencyAlert = this.detectConsistencyViolations(event, agentHistory);
    if (consistencyAlert) alerts.push(consistencyAlert);
    
    // 4. Resource Usage Pattern Analysis
    const resourceAlert = this.analyzeResourcePatterns(event, agentHistory);
    if (resourceAlert) alerts.push(resourceAlert);
    
    // 5. Cross-Agent Correlation Analysis
    const correlationAlert = await this.analyzeCrossAgentPatterns(event);
    if (correlationAlert) alerts.push(correlationAlert);
    
    return alerts;
  }

  /**
   * Detect timing-based deception patterns
   */
  private analyzeTimingPatterns(event: MeasurementEvent, history: MeasurementEvent[]): DeceptionAlert | null {
    if (history.length < 10) return null;
    
    const recentEvents = history.slice(-20);
    const responseTimes = recentEvents.map(e => e.responseTime);
    
    // Calculate statistical measures
    const mean = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const variance = responseTimes.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / responseTimes.length;
    const stdDev = Math.sqrt(variance);
    
    // Z-score for current event
    const zScore = Math.abs((event.responseTime - mean) / stdDev);
    
    // Detect several suspicious patterns
    const patterns: Array<{name: string, condition: boolean, severity: 'low' | 'medium' | 'high' | 'critical'}> = [
      {
        name: 'impossibly_fast_complex_operation',
        condition: event.operation.includes('analyzeLayoutGrid') && event.responseTime < 10,
        severity: 'critical'
      },
      {
        name: 'suspiciously_consistent_timing',
        condition: stdDev < 2 && mean > 5, // Too consistent
        severity: 'high'
      },
      {
        name: 'statistical_outlier',
        condition: zScore > 3, // More than 3 standard deviations
        severity: 'medium'
      },
      {
        name: 'round_number_timing',
        condition: event.responseTime % 10 === 0 && event.responseTime > 0,
        severity: 'low'
      }
    ];
    
    const triggeredPattern = patterns.find(p => p.condition);
    if (!triggeredPattern) return null;
    
    return {
      agentId: event.agentId,
      severity: triggeredPattern.severity,
      pattern: triggeredPattern.name,
      confidence: triggeredPattern.severity === 'critical' ? 0.95 : 
                 triggeredPattern.severity === 'high' ? 0.8 : 
                 triggeredPattern.severity === 'medium' ? 0.6 : 0.4,
      evidence: [
        { currentResponseTime: event.responseTime },
        { mean, stdDev, zScore },
        { operation: event.operation }
      ],
      timestamp: new Date(),
      recommendedAction: triggeredPattern.severity === 'critical' ? 'immediate_quarantine' :
                        triggeredPattern.severity === 'high' ? 'escalate_verification' :
                        'increase_monitoring'
    };
  }

  /**
   * Statistical anomaly detection using Benford's Law and other techniques
   */
  private detectStatisticalAnomalies(event: MeasurementEvent, history: MeasurementEvent[]): DeceptionAlert | null {
    if (!event.result?.dimensions || history.length < 50) return null;
    
    const dimensions = history
      .filter(e => e.result?.dimensions)
      .map(e => e.result.dimensions);
    
    dimensions.push(event.result.dimensions);
    
    // Benford's Law analysis for first digits
    const firstDigits = this.extractFirstDigits(dimensions);
    const benfordDeviation = this.calculateBenfordDeviation(firstDigits);
    
    // Distribution analysis
    const distributionAnomalies = this.analyzeValueDistribution(dimensions);
    
    if (benfordDeviation > 0.15 || distributionAnomalies.length > 0) {
      return {
        agentId: event.agentId,
        severity: benfordDeviation > 0.3 ? 'high' : 'medium',
        pattern: 'statistical_anomaly',
        confidence: Math.min(0.9, benfordDeviation * 2),
        evidence: [
          { benfordDeviation },
          { distributionAnomalies },
          { sampleSize: dimensions.length }
        ],
        timestamp: new Date(),
        recommendedAction: 'verify_measurement_authenticity'
      };
    }
    
    return null;
  }

  /**
   * Detect consistency violations in measurement results
   */
  private detectConsistencyViolations(event: MeasurementEvent, history: MeasurementEvent[]): DeceptionAlert | null {
    if (!event.result?.dimensions) return null;
    
    // Look for physically impossible changes
    const recentSimilarMeasurements = history
      .filter(e => 
        e.selector === event.selector && 
        e.timestamp > new Date(Date.now() - 5 * 60 * 1000) && // Last 5 minutes
        e.result?.dimensions
      )
      .slice(-5);
    
    if (recentSimilarMeasurements.length === 0) return null;
    
    const violations: string[] = [];
    
    for (const prev of recentSimilarMeasurements) {
      const widthChange = Math.abs(event.result.dimensions.width - prev.result.dimensions.width);
      const heightChange = Math.abs(event.result.dimensions.height - prev.result.dimensions.height);
      
      // Elements shouldn't change dramatically without user interaction
      if (widthChange > 100 || heightChange > 100) {
        violations.push(`Dramatic size change: ${widthChange}x${heightChange}px`);
      }
      
      // Position changes should be reasonable
      const xChange = Math.abs(event.result.dimensions.x - prev.result.dimensions.x);
      const yChange = Math.abs(event.result.dimensions.y - prev.result.dimensions.y);
      
      if (xChange > 500 || yChange > 500) {
        violations.push(`Extreme position change: ${xChange},${yChange}px`);
      }
    }
    
    if (violations.length > 0) {
      return {
        agentId: event.agentId,
        severity: 'high',
        pattern: 'consistency_violation',
        confidence: 0.85,
        evidence: [
          { violations },
          { selector: event.selector },
          { comparisons: recentSimilarMeasurements.length }
        ],
        timestamp: new Date(),
        recommendedAction: 'verify_dom_stability'
      };
    }
    
    return null;
  }

  /**
   * Analyze resource usage patterns for anomalies
   */
  private analyzeResourcePatterns(event: MeasurementEvent, history: MeasurementEvent[]): DeceptionAlert | null {
    const recentEvents = history.slice(-20);
    if (recentEvents.length < 10) return null;
    
    // Analyze CPU and memory usage patterns
    const cpuUsages = recentEvents.map(e => e.systemMetrics.cpuUsage);
    const memoryUsages = recentEvents.map(e => e.systemMetrics.memoryUsage);
    
    const avgCpu = cpuUsages.reduce((sum, cpu) => sum + cpu, 0) / cpuUsages.length;
    const avgMemory = memoryUsages.reduce((sum, mem) => sum + mem, 0) / memoryUsages.length;
    
    // Complex operations should use more resources
    const complexOperation = event.operation.includes('analyzeLayoutGrid') || 
                           event.operation.includes('measureDistances');
    
    if (complexOperation && (event.systemMetrics.cpuUsage < 1 || event.systemMetrics.memoryUsage < 5)) {
      return {
        agentId: event.agentId,
        severity: 'high',
        pattern: 'insufficient_resource_usage',
        confidence: 0.8,
        evidence: [
          { operation: event.operation },
          { cpuUsage: event.systemMetrics.cpuUsage },
          { memoryUsage: event.systemMetrics.memoryUsage },
          { averages: { cpu: avgCpu, memory: avgMemory } }
        ],
        timestamp: new Date(),
        recommendedAction: 'verify_actual_execution'
      };
    }
    
    return null;
  }

  /**
   * Cross-agent correlation analysis to detect coordinated deception
   */
  private async analyzeCrossAgentPatterns(event: MeasurementEvent): Promise<DeceptionAlert | null> {
    const allAgents = Array.from(this.eventHistory.keys());
    if (allAgents.length < 2) return null;
    
    // Look for suspiciously similar timing patterns across agents
    const correlations: Array<{agentId: string, correlation: number}> = [];
    
    for (const otherAgentId of allAgents) {
      if (otherAgentId === event.agentId) continue;
      
      const otherHistory = this.eventHistory.get(otherAgentId) || [];
      const correlation = this.calculateTimingCorrelation(
        this.eventHistory.get(event.agentId) || [],
        otherHistory
      );
      
      if (correlation > 0.8) {
        correlations.push({ agentId: otherAgentId, correlation });
      }
    }
    
    if (correlations.length > 0) {
      return {
        agentId: event.agentId,
        severity: 'critical',
        pattern: 'coordinated_behavior',
        confidence: 0.9,
        evidence: [
          { correlatedAgents: correlations },
          { suspiciousCorrelations: correlations.length }
        ],
        timestamp: new Date(),
        recommendedAction: 'investigate_agent_collusion'
      };
    }
    
    return null;
  }

  /**
   * Extract first digits for Benford's Law analysis
   */
  private extractFirstDigits(dimensions: any[]): number[] {
    const values: number[] = [];
    
    for (const dim of dimensions) {
      if (dim.width > 0) values.push(parseInt(String(dim.width)[0]));
      if (dim.height > 0) values.push(parseInt(String(dim.height)[0]));
      if (dim.x > 0) values.push(parseInt(String(dim.x)[0]));
      if (dim.y > 0) values.push(parseInt(String(dim.y)[0]));
    }
    
    return values.filter(v => v >= 1 && v <= 9);
  }

  /**
   * Calculate deviation from Benford's Law
   */
  private calculateBenfordDeviation(firstDigits: number[]): number {
    if (firstDigits.length < 30) return 0; // Need sufficient sample size
    
    const observed = new Array(10).fill(0);
    firstDigits.forEach(digit => observed[digit]++);
    
    // Benford's Law expected frequencies
    const expected = [0, 0.301, 0.176, 0.125, 0.097, 0.079, 0.067, 0.058, 0.051, 0.046];
    
    let chiSquare = 0;
    for (let i = 1; i <= 9; i++) {
      const expectedCount = expected[i] * firstDigits.length;
      const observedCount = observed[i];
      if (expectedCount > 0) {
        chiSquare += Math.pow(observedCount - expectedCount, 2) / expectedCount;
      }
    }
    
    // Convert chi-square to normalized deviation (0-1)
    return Math.min(1, chiSquare / 15.507); // Critical value for 8 degrees of freedom at p=0.05
  }

  /**
   * Analyze value distribution for anomalies
   */
  private analyzeValueDistribution(dimensions: any[]): StatisticalAnomaly[] {
    const anomalies: StatisticalAnomaly[] = [];
    
    // Check for suspicious clustering around round numbers
    const widths = dimensions.map(d => d.width).filter(w => w > 0);
    const roundWidths = widths.filter(w => w % 10 === 0);
    
    if (roundWidths.length > widths.length * 0.7) {
      anomalies.push({
        metric: 'width_clustering',
        expectedRange: [0, widths.length * 0.3],
        actualValue: roundWidths.length,
        zScore: (roundWidths.length - widths.length * 0.3) / Math.sqrt(widths.length * 0.3 * 0.7),
        pValue: 0.001 // Highly unlikely
      });
    }
    
    return anomalies;
  }

  /**
   * Calculate timing correlation between two agents
   */
  private calculateTimingCorrelation(events1: MeasurementEvent[], events2: MeasurementEvent[]): number {
    if (events1.length < 10 || events2.length < 10) return 0;
    
    const times1 = events1.slice(-20).map(e => e.responseTime);
    const times2 = events2.slice(-20).map(e => e.responseTime);
    
    return this.pearsonCorrelation(times1, times2);
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 3) return 0;
    
    const xSlice = x.slice(0, n);
    const ySlice = y.slice(0, n);
    
    const meanX = xSlice.reduce((sum, val) => sum + val, 0) / n;
    const meanY = ySlice.reduce((sum, val) => sum + val, 0) / n;
    
    let numerator = 0;
    let denomX = 0;
    let denomY = 0;
    
    for (let i = 0; i < n; i++) {
      const diffX = xSlice[i] - meanX;
      const diffY = ySlice[i] - meanY;
      
      numerator += diffX * diffY;
      denomX += diffX * diffX;
      denomY += diffY * diffY;
    }
    
    const denominator = Math.sqrt(denomX * denomY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Add event to agent history with size management
   */
  private addToHistory(event: MeasurementEvent): void {
    if (!this.eventHistory.has(event.agentId)) {
      this.eventHistory.set(event.agentId, []);
    }
    
    const history = this.eventHistory.get(event.agentId)!;
    history.push(event);
    
    // Maintain maximum history size
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.splice(0, history.length - this.MAX_HISTORY_SIZE);
    }
  }

  /**
   * Update baseline metrics for agent behavior
   */
  private updateBaseline(event: MeasurementEvent): void {
    // Implementation for baseline metric updates
    // This would track normal behavior patterns over time
  }

  /**
   * Start continuous monitoring background process
   */
  private startContinuousMonitoring(): void {
    setInterval(() => {
      this.performPeriodicAnalysis();
    }, this.DETECTION_WINDOW);
  }

  /**
   * Periodic analysis for long-term pattern detection
   */
  private performPeriodicAnalysis(): void {
    for (const [agentId, events] of this.eventHistory) {
      const recentEvents = events.filter(
        e => e.timestamp > new Date(Date.now() - this.DETECTION_WINDOW)
      );
      
      if (recentEvents.length > 0) {
        this.analyzeLongTermTrends(agentId, events);
      }
    }
  }

  /**
   * Analyze long-term behavioral trends
   */
  private analyzeLongTermTrends(agentId: string, events: MeasurementEvent[]): void {
    // Implementation for trend analysis
    // Look for gradual degradation in trust indicators
    // Detect learning/adaptation in deceptive behavior
  }
}

interface BaselineMetrics {
  averageResponseTime: number;
  typicalResourceUsage: {
    cpu: number;
    memory: number;
  };
  commonOperations: Map<string, number>;
  behaviorVariance: number;
}

interface SuspiciousPattern {
  name: string;
  occurrences: number;
  lastSeen: Date;
  severity: number;
}