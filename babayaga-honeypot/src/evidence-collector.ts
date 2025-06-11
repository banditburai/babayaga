/**
 * Evidence Collector for Checklist-Driven Agent Testing
 * Automatically captures and stores evidence of agent test execution
 */

import { TestLog, TestEvidence, ToolCall, NetworkRequest } from './checklist-agent-runner.js';
import { logger } from '@babayaga/shared';

export class EvidenceCollector {
  private activeCollections: Map<string, TestItemCollection> = new Map();
  private globalEvidence: TestEvidence;

  constructor(_sessionId: string) {
    this.globalEvidence = this.initializeEvidence();
  }

  /**
   * Start collecting evidence for a specific test item
   */
  startCollecting(itemId: string): void {
    const collection: TestItemCollection = {
      itemId,
      startTime: new Date().toISOString(),
      evidence: this.initializeEvidence()
    };
    
    this.activeCollections.set(itemId, collection);
    logger.info(`🎬 Started evidence collection for test item: ${itemId}`);
  }

  /**
   * Stop collecting evidence and return all collected data
   */
  async stopCollecting(itemId: string): Promise<TestEvidence> {
    const collection = this.activeCollections.get(itemId);
    if (!collection) {
      throw new Error(`No active collection for item: ${itemId}`);
    }
    
    collection.endTime = new Date().toISOString();
    const evidence = collection.evidence;
    
    // Add collection summary log
    this.addLog(itemId, `Evidence collection completed: ${evidence.logs.length} logs, ${evidence.toolCalls.length} tool calls`, {
      duration: Date.now() - new Date(collection.startTime).getTime(),
      evidenceQuality: this.calculateEvidenceQuality(evidence)
    });
    
    this.activeCollections.delete(itemId);
    logger.info(`🎬 Stopped evidence collection for test item: ${itemId}`);
    
    return evidence;
  }

  /**
   * Add a log entry to the evidence
   */
  addLog(itemId: string, message: string, context?: any): void {
    const log: TestLog = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      context
    };
    
    const collection = this.activeCollections.get(itemId);
    if (collection) {
      collection.evidence.logs.push(log);
    }
    
    // Also add to global evidence
    this.globalEvidence.logs.push({
      ...log,
      context: { ...context, itemId }
    });
  }

  /**
   * Add a tool call to the evidence
   */
  addToolCall(itemId: string, toolCall: ToolCall): void {
    const collection = this.activeCollections.get(itemId);
    if (collection) {
      collection.evidence.toolCalls.push(toolCall);
    }
    
    // Also add to global evidence
    this.globalEvidence.toolCalls.push({
      ...toolCall,
      parameters: { ...toolCall.parameters, _itemId: itemId }
    });
  }

  /**
   * Add a screenshot to the evidence
   */
  async addScreenshot(itemId: string, screenshotPath: string, description?: string): Promise<void> {
    const collection = this.activeCollections.get(itemId);
    if (collection) {
      collection.evidence.screenshots.push(screenshotPath);
    }
    
    this.globalEvidence.screenshots.push(screenshotPath);
    
    this.addLog(itemId, `Screenshot captured: ${description || 'Test screenshot'}`, {
      screenshotPath,
      fileSize: await this.getFileSize(screenshotPath)
    });
  }

  /**
   * Add measurement data to the evidence
   */
  addMeasurement(itemId: string, measurement: any): void {
    const collection = this.activeCollections.get(itemId);
    if (collection) {
      collection.evidence.measurements.push(measurement);
    }
    
    this.globalEvidence.measurements.push({
      ...measurement,
      _itemId: itemId,
      _timestamp: new Date().toISOString()
    });
    
    this.addLog(itemId, 'Measurement captured', {
      measurementType: measurement.selector ? 'element' : 'unknown',
      dataSize: JSON.stringify(measurement).length
    });
  }

  /**
   * Add network request to the evidence
   */
  addNetworkRequest(itemId: string, request: NetworkRequest): void {
    const collection = this.activeCollections.get(itemId);
    if (collection) {
      collection.evidence.networkRequests.push(request);
    }
    
    this.globalEvidence.networkRequests.push({
      ...request
    });
    
    this.addLog(itemId, `Network request: ${request.method} ${request.url}`, {
      status: request.status,
      responseSize: request.responseSize
    });
  }

  /**
   * Add error message to the evidence
   */
  addError(itemId: string, error: string, context?: any): void {
    const collection = this.activeCollections.get(itemId);
    if (collection) {
      collection.evidence.errorMessages.push(error);
    }
    
    this.globalEvidence.errorMessages.push(error);
    
    this.addLog(itemId, `Error occurred: ${error}`, {
      level: 'error',
      ...context
    });
  }

  /**
   * Get current evidence for a test item
   */
  getCurrentEvidence(itemId: string): TestEvidence | null {
    const collection = this.activeCollections.get(itemId);
    return collection ? { ...collection.evidence } : null;
  }

  /**
   * Get all collected evidence across all test items
   */
  getAllEvidence(): TestEvidence {
    return { ...this.globalEvidence };
  }

  /**
   * Export evidence as JSON for storage/analysis
   */
  exportEvidence(itemId?: string): string {
    const evidence = itemId ? this.getCurrentEvidence(itemId) : this.getAllEvidence();
    return JSON.stringify(evidence, null, 2);
  }

  /**
   * Validate evidence meets minimum requirements
   */
  validateEvidence(itemId: string): EvidenceValidation {
    const collection = this.activeCollections.get(itemId);
    if (!collection) {
      return {
        valid: false,
        issues: ['No evidence collection found'],
        score: 0
      };
    }
    
    const evidence = collection.evidence;
    const issues: string[] = [];
    let score = 0;
    
    // Check minimum requirements
    if (evidence.logs.length === 0) {
      issues.push('No logs captured');
    } else {
      score += 25;
    }
    
    if (evidence.toolCalls.length === 0) {
      issues.push('No tool calls recorded');
    } else {
      score += 35;
    }
    
    // Quality checks
    if (evidence.screenshots.length > 0) score += 15;
    if (evidence.measurements.length > 0) score += 15;
    if (evidence.errorMessages.length === 0) score += 10; // No errors is good
    
    // Timing validation
    const suspiciouslyFastCalls = evidence.toolCalls.filter(call => call.duration < 5);
    if (suspiciouslyFastCalls.length > 0) {
      issues.push(`${suspiciouslyFastCalls.length} tool calls completed impossibly fast (<5ms)`);
      score -= 20;
    }
    
    // Log quality check
    const infoLogs = evidence.logs.filter(log => log.level === 'info').length;
    if (infoLogs < 2) {
      issues.push('Insufficient detailed logging');
      score -= 10;
    }
    
    return {
      valid: issues.length === 0 && score >= 50,
      issues,
      score: Math.max(0, Math.min(100, score))
    };
  }

  // Private helper methods
  private initializeEvidence(): TestEvidence {
    return {
      logs: [],
      screenshots: [],
      measurements: [],
      networkRequests: [],
      errorMessages: [],
      toolCalls: []
    };
  }

  private calculateEvidenceQuality(evidence: TestEvidence): number {
    let quality = 0;
    
    // Base quality for having evidence
    if (evidence.logs.length > 0) quality += 20;
    if (evidence.toolCalls.length > 0) quality += 30;
    if (evidence.screenshots.length > 0) quality += 20;
    if (evidence.measurements.length > 0) quality += 20;
    
    // Quality bonuses
    if (evidence.logs.length >= 5) quality += 5; // Detailed logging
    if (evidence.toolCalls.some(call => call.duration > 20)) quality += 5; // Realistic timing
    
    return Math.min(quality, 100);
  }

  private async getFileSize(filePath: string): Promise<number> {
    try {
      const fs = await import('fs/promises');
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }
}

interface TestItemCollection {
  itemId: string;
  startTime: string;
  endTime?: string;
  evidence: TestEvidence;
}

interface EvidenceValidation {
  valid: boolean;
  issues: string[];
  score: number;
}