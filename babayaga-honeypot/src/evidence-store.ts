/**
 * Evidence Store - Manages evidence artifacts and validation
 * 
 * Handles storage, retrieval, and validation of evidence collected
 * during test execution with comprehensive integrity checking.
 */

import { promises as fs } from 'fs';
import { createReadStream, createWriteStream } from 'fs';
import { join, extname, basename } from 'path';
import { createHash } from 'crypto';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { logger } from '@babayaga/shared';
import {
  Evidence,
  LogEntry,
  ToolCall,
  EvidenceStoreConfig,
  EvidenceQuery,
  EvidenceError,
  HoneypotError
} from './types.js';

export class EvidenceStore {
  private config: Required<EvidenceStoreConfig>;
  private fileLocks = new Set<string>(); // Track locked files for concurrent access
  private readonly COMPRESSION_THRESHOLD = 1024 * 1024; // 1MB

  constructor(config: Partial<EvidenceStoreConfig> = {}) {
    this.config = {
      dataDir: config.dataDir || join(process.cwd(), 'babayaga-honeypot', 'data', 'evidence'),
      maxFileSize: 10 * 1024 * 1024, // 10MB
      compressionEnabled: true,
      encryptionEnabled: false,
      retentionDays: 30,
      ...config
    };
  }

  async initialize(): Promise<void> {
    try {
      await this.ensureDirectories();
      logger.info('EvidenceStore initialized', {
        dataDir: this.config.dataDir,
        maxFileSize: this.config.maxFileSize,
        retentionDays: this.config.retentionDays
      });
    } catch (error) {
      logger.error('Failed to initialize EvidenceStore', {}, error as Error);
      throw new HoneypotError('EvidenceStore initialization failed', 'INIT_ERROR', { error });
    }
  }

  // ============================================================================
  // EVIDENCE COLLECTION
  // ============================================================================

  async storeEvidence(sessionId: string, itemId: string, evidence: Evidence): Promise<Evidence> {
    try {
      // Create session directory
      const sessionDir = await this.ensureSessionDirectory(sessionId);
      
      // Store each evidence type
      const storedEvidence: Evidence = {
        logs: evidence.logs,
        toolCalls: evidence.toolCalls,
        screenshots: await this.storeScreenshots(sessionDir, itemId, evidence.screenshots),
        measurements: evidence.measurements,
        errors: evidence.errors,
        metadata: {
          ...evidence.metadata,
          storedAt: new Date().toISOString(),
          checksums: await this.calculateChecksums(evidence)
        }
      };

      // Store evidence index
      await this.storeEvidenceIndex(sessionId, itemId, storedEvidence);

      logger.debug('Evidence stored', {
        sessionId,
        itemId,
        logCount: evidence.logs.length,
        toolCallCount: evidence.toolCalls.length,
        screenshotCount: evidence.screenshots.length,
        measurementCount: evidence.measurements.length,
        errorCount: evidence.errors.length
      });

      return storedEvidence;
    } catch (error) {
      logger.error('Failed to store evidence', { sessionId, itemId }, error as Error);
      throw new EvidenceError(
        `Failed to store evidence: ${(error as Error).message}`,
        'storage',
        { sessionId, itemId, originalError: error }
      );
    }
  }

  async getEvidence(sessionId: string, itemId?: string): Promise<Evidence[]> {
    try {
      const sessionDir = this.getSessionDirectory(sessionId);
      
      // Check if session directory exists
      try {
        await fs.access(sessionDir);
      } catch {
        return [];
      }

      const evidenceFiles = await this.findEvidenceFiles(sessionDir, itemId);
      const evidence: Evidence[] = [];

      for (const file of evidenceFiles) {
        try {
          const evidenceData = await fs.readFile(file, 'utf8');
          const parsedEvidence = JSON.parse(evidenceData) as Evidence;
          
          // Restore screenshot file paths
          parsedEvidence.screenshots = await this.restoreScreenshotPaths(
            sessionDir, 
            parsedEvidence.screenshots
          );
          
          evidence.push(parsedEvidence);
        } catch (error) {
          logger.warn('Failed to load evidence file', { file }, error as Error);
        }
      }

      return evidence;
    } catch (error) {
      logger.error('Failed to get evidence', { sessionId, itemId }, error as Error);
      throw new EvidenceError(
        `Failed to retrieve evidence: ${(error as Error).message}`,
        'retrieval',
        { sessionId, itemId, originalError: error }
      );
    }
  }

  // ============================================================================
  // LOG MANAGEMENT
  // ============================================================================

  async addLog(sessionId: string, itemId: string, logEntry: LogEntry): Promise<void> {
    try {
      const logsDir = join(this.getSessionDirectory(sessionId), 'logs');
      await this.ensureDirectory(logsDir);
      
      const logFile = join(logsDir, `${itemId || 'global'}.jsonl`);
      const logLine = JSON.stringify(logEntry) + '\n';
      
      await fs.appendFile(logFile, logLine, 'utf8');
      
      logger.trace('Log entry added', {
        sessionId,
        itemId,
        logLevel: logEntry.level,
        message: logEntry.message.substring(0, 100)
      });
    } catch (error) {
      logger.error('Failed to add log entry', { sessionId, itemId }, error as Error);
      throw new EvidenceError(
        `Failed to add log entry: ${(error as Error).message}`,
        'logs',
        { sessionId, itemId, originalError: error }
      );
    }
  }

  async getLogs(sessionId: string, itemId?: string): Promise<LogEntry[]> {
    try {
      const logsDir = join(this.getSessionDirectory(sessionId), 'logs');
      
      try {
        await fs.access(logsDir);
      } catch {
        return [];
      }

      const logs: LogEntry[] = [];
      const files = await fs.readdir(logsDir);
      
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;
        if (itemId && !file.startsWith(itemId)) continue;
        
        try {
          const logPath = join(logsDir, file);
          const content = await fs.readFile(logPath, 'utf8');
          const lines = content.trim().split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const logEntry = JSON.parse(line) as LogEntry;
              logs.push(logEntry);
            } catch (parseError) {
              logger.warn('Failed to parse log line', { file, line: line.substring(0, 100) });
            }
          }
        } catch (error) {
          logger.warn('Failed to read log file', { file }, error as Error);
        }
      }
      
      return logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    } catch (error) {
      logger.error('Failed to get logs', { sessionId, itemId }, error as Error);
      throw new EvidenceError(
        `Failed to retrieve logs: ${(error as Error).message}`,
        'logs',
        { sessionId, itemId, originalError: error }
      );
    }
  }

  // ============================================================================
  // TOOL CALL MANAGEMENT
  // ============================================================================

  async addToolCall(sessionId: string, toolCall: ToolCall): Promise<void> {
    try {
      const toolCallsDir = join(this.getSessionDirectory(sessionId), 'tool-calls');
      await this.ensureDirectory(toolCallsDir);
      
      const toolCallFile = join(toolCallsDir, `${toolCall.itemId || 'global'}.jsonl`);
      const toolCallLine = JSON.stringify(toolCall) + '\n';
      
      await fs.appendFile(toolCallFile, toolCallLine, 'utf8');
      
      logger.trace('Tool call recorded', {
        sessionId,
        itemId: toolCall.itemId,
        toolName: toolCall.toolName,
        duration: toolCall.duration,
        success: toolCall.success
      });
    } catch (error) {
      logger.error('Failed to add tool call', { sessionId, toolCall: toolCall.id }, error as Error);
      throw new EvidenceError(
        `Failed to add tool call: ${(error as Error).message}`,
        'toolCalls',
        { sessionId, toolCallId: toolCall.id, originalError: error }
      );
    }
  }

  async getToolCalls(sessionId: string, itemId?: string): Promise<ToolCall[]> {
    try {
      const toolCallsDir = join(this.getSessionDirectory(sessionId), 'tool-calls');
      
      try {
        await fs.access(toolCallsDir);
      } catch {
        return [];
      }

      const toolCalls: ToolCall[] = [];
      const files = await fs.readdir(toolCallsDir);
      
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;
        if (itemId && !file.startsWith(itemId)) continue;
        
        try {
          const toolCallPath = join(toolCallsDir, file);
          const content = await fs.readFile(toolCallPath, 'utf8');
          const lines = content.trim().split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const toolCall = JSON.parse(line) as ToolCall;
              toolCalls.push(toolCall);
            } catch (parseError) {
              logger.warn('Failed to parse tool call line', { file });
            }
          }
        } catch (error) {
          logger.warn('Failed to read tool call file', { file }, error as Error);
        }
      }
      
      return toolCalls.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    } catch (error) {
      logger.error('Failed to get tool calls', { sessionId, itemId }, error as Error);
      throw new EvidenceError(
        `Failed to retrieve tool calls: ${(error as Error).message}`,
        'toolCalls',
        { sessionId, itemId, originalError: error }
      );
    }
  }

  // ============================================================================
  // SCREENSHOT MANAGEMENT
  // ============================================================================

  async storeScreenshot(sessionId: string, itemId: string, screenshotData: string, filename?: string): Promise<string> {
    const lockKey = `screenshot_${sessionId}_${itemId}`;
    
    // File locking for concurrent access
    if (this.fileLocks.has(lockKey)) {
      throw new EvidenceError(
        `Screenshot for session ${sessionId}, item ${itemId} is currently being stored`,
        'screenshots',
        { sessionId, itemId }
      );
    }
    
    this.fileLocks.add(lockKey);
    
    try {
      const screenshotsDir = join(this.getSessionDirectory(sessionId), 'screenshots');
      await this.ensureDirectory(screenshotsDir);
      
      // Generate filename if not provided
      if (!filename) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        filename = `${itemId}-${timestamp}.png`;
      }
      
      const screenshotPath = join(screenshotsDir, filename);
      
      // Handle base64 data
      let data: Buffer;
      if (screenshotData.startsWith('data:image/')) {
        const base64Data = screenshotData.split(',')[1];
        data = Buffer.from(base64Data, 'base64');
      } else if (screenshotData.startsWith('iVBOR') || screenshotData.startsWith('/9j/')) {
        data = Buffer.from(screenshotData, 'base64');
      } else {
        // Assume it's a file path
        data = await fs.readFile(screenshotData);
      }
      
      // Check file size
      if (data.length > this.config.maxFileSize) {
        throw new EvidenceError(
          `Screenshot size ${data.length} exceeds maximum ${this.config.maxFileSize}`,
          'screenshots',
          { sessionId, itemId, filename }
        );
      }
      
      // Compress large screenshots if enabled
      const shouldCompress = this.config.compressionEnabled && data.length > this.COMPRESSION_THRESHOLD;
      const finalPath = shouldCompress ? `${screenshotPath}.gz` : screenshotPath;
      
      if (shouldCompress) {
        await this.saveCompressedFile(data, finalPath);
        logger.debug('Screenshot stored with compression', {
          sessionId,
          itemId,
          filename,
          originalSize: data.length,
          compressed: true
        });
      } else {
        await fs.writeFile(screenshotPath, data);
        logger.debug('Screenshot stored', {
          sessionId,
          itemId,
          filename,
          size: data.length,
          compressed: false
        });
      }
      
      return finalPath;
    } catch (error) {
      logger.error('Failed to store screenshot', { sessionId, itemId, filename }, error as Error);
      throw new EvidenceError(
        `Failed to store screenshot: ${(error as Error).message}`,
        'screenshots',
        { sessionId, itemId, filename, originalError: error }
      );
    } finally {
      this.fileLocks.delete(lockKey);
    }
  }

  // ============================================================================
  // COMPRESSION UTILITIES FOR EVIDENCE
  // ============================================================================

  private async saveCompressedFile(data: Buffer, filePath: string): Promise<void> {
    const readStream = createReadStream(data);
    const writeStream = createWriteStream(filePath);
    const gzipStream = createGzip({ level: 6 });
    
    await pipeline(readStream, gzipStream, writeStream);
  }

  private async loadCompressedFile(filePath: string): Promise<Buffer> {
    const readStream = createReadStream(filePath);
    const gunzipStream = createGunzip();
    
    const chunks: Buffer[] = [];
    await pipeline(
      readStream,
      gunzipStream,
      async function* (source) {
        for await (const chunk of source) {
          chunks.push(chunk);
          yield chunk;
        }
      }
    );
    
    return Buffer.concat(chunks);
  }

  private async storeScreenshots(sessionDir: string, itemId: string, screenshots: string[]): Promise<string[]> {
    const storedPaths: string[] = [];
    
    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i];
      const filename = `${itemId}-${i + 1}.png`;
      
      try {
        const storedPath = await this.storeScreenshot(
          basename(sessionDir), 
          itemId, 
          screenshot, 
          filename
        );
        storedPaths.push(storedPath);
      } catch (error) {
        logger.warn('Failed to store screenshot', { itemId, index: i }, error as Error);
        storedPaths.push(screenshot); // Keep original path as fallback
      }
    }
    
    return storedPaths;
  }

  private async restoreScreenshotPaths(sessionDir: string, screenshots: string[]): Promise<string[]> {
    return screenshots.map(screenshot => {
      // If it's already a full path, return as-is
      if (screenshot.startsWith('/') || screenshot.startsWith('data:')) {
        return screenshot;
      }
      
      // Assume it's a relative path from screenshots directory
      return join(sessionDir, 'screenshots', screenshot);
    });
  }

  // ============================================================================
  // EVIDENCE VALIDATION
  // ============================================================================

  async validateEvidence(sessionId: string, itemId: string): Promise<{
    valid: boolean;
    issues: string[];
    integrity: { [key: string]: boolean };
  }> {
    try {
      const evidence = await this.getEvidence(sessionId, itemId);
      const issues: string[] = [];
      const integrity: { [key: string]: boolean } = {};
      
      for (const evidenceItem of evidence) {
        // Validate checksums
        const expectedChecksums = evidenceItem.metadata.checksums || {};
        const actualChecksums = await this.calculateChecksums(evidenceItem);
        
        for (const [type, expectedChecksum] of Object.entries(expectedChecksums)) {
          const actualChecksum = actualChecksums[type];
          integrity[type] = expectedChecksum === actualChecksum;
          
          if (!integrity[type]) {
            issues.push(`Checksum mismatch for ${type}: expected ${expectedChecksum}, got ${actualChecksum}`);
          }
        }
        
        // Validate screenshots exist
        for (const screenshot of evidenceItem.screenshots) {
          try {
            await fs.access(screenshot);
            integrity[`screenshot_${basename(screenshot)}`] = true;
          } catch {
            integrity[`screenshot_${basename(screenshot)}`] = false;
            issues.push(`Screenshot not found: ${screenshot}`);
          }
        }
        
        // Validate evidence completeness
        if (evidenceItem.logs.length === 0) {
          issues.push('No logs found in evidence');
        }
        
        if (evidenceItem.toolCalls.length === 0) {
          issues.push('No tool calls found in evidence');
        }
      }
      
      return {
        valid: issues.length === 0,
        issues,
        integrity
      };
    } catch (error) {
      logger.error('Failed to validate evidence', { sessionId, itemId }, error as Error);
      throw new EvidenceError(
        `Failed to validate evidence: ${(error as Error).message}`,
        'validation',
        { sessionId, itemId, originalError: error }
      );
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private async calculateChecksums(evidence: Evidence): Promise<{ [key: string]: string }> {
    const checksums: { [key: string]: string } = {};
    
    // Hash logs
    if (evidence.logs.length > 0) {
      const logsHash = createHash('sha256');
      logsHash.update(JSON.stringify(evidence.logs));
      checksums.logs = logsHash.digest('hex');
    }
    
    // Hash tool calls
    if (evidence.toolCalls.length > 0) {
      const toolCallsHash = createHash('sha256');
      toolCallsHash.update(JSON.stringify(evidence.toolCalls));
      checksums.toolCalls = toolCallsHash.digest('hex');
    }
    
    // Hash measurements
    if (evidence.measurements.length > 0) {
      const measurementsHash = createHash('sha256');
      measurementsHash.update(JSON.stringify(evidence.measurements));
      checksums.measurements = measurementsHash.digest('hex');
    }
    
    return checksums;
  }

  private async storeEvidenceIndex(sessionId: string, itemId: string, evidence: Evidence): Promise<void> {
    const sessionDir = this.getSessionDirectory(sessionId);
    const indexPath = join(sessionDir, `${itemId}-evidence.json`);
    await fs.writeFile(indexPath, JSON.stringify(evidence, null, 2), 'utf8');
  }

  private async findEvidenceFiles(sessionDir: string, itemId?: string): Promise<string[]> {
    const files = await fs.readdir(sessionDir);
    return files
      .filter(file => file.endsWith('-evidence.json'))
      .filter(file => !itemId || file.startsWith(itemId))
      .map(file => join(sessionDir, file));
  }

  private getSessionDirectory(sessionId: string): string {
    return join(this.config.dataDir, sessionId);
  }

  private async ensureSessionDirectory(sessionId: string): Promise<string> {
    const sessionDir = this.getSessionDirectory(sessionId);
    await this.ensureDirectory(sessionDir);
    return sessionDir;
  }

  private async ensureDirectories(): Promise<void> {
    await this.ensureDirectory(this.config.dataDir);
  }

  private async ensureDirectory(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  // ============================================================================
  // CLEANUP AND MAINTENANCE
  // ============================================================================

  async cleanup(): Promise<void> {
    try {
      // Clean up old evidence based on retention policy
      await this.cleanupOldEvidence();
      logger.info('EvidenceStore cleanup completed');
    } catch (error) {
      logger.error('EvidenceStore cleanup failed', {}, error as Error);
    }
  }

  private async cleanupOldEvidence(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
    
    try {
      const sessions = await fs.readdir(this.config.dataDir);
      
      for (const sessionId of sessions) {
        const sessionDir = join(this.config.dataDir, sessionId);
        const stat = await fs.stat(sessionDir);
        
        if (stat.isDirectory() && stat.mtime < cutoffDate) {
          await fs.rm(sessionDir, { recursive: true, force: true });
          logger.debug('Cleaned up old evidence', { sessionId, age: cutoffDate.getTime() - stat.mtime.getTime() });
        }
      }
    } catch (error) {
      logger.warn('Failed to cleanup old evidence', {}, error as Error);
    }
  }

  // ============================================================================
  // METRICS AND MONITORING
  // ============================================================================

  getMetrics() {
    return {
      dataDirectory: this.config.dataDir,
      maxFileSize: this.config.maxFileSize,
      retentionDays: this.config.retentionDays,
      compressionEnabled: this.config.compressionEnabled,
      encryptionEnabled: this.config.encryptionEnabled
    };
  }
}