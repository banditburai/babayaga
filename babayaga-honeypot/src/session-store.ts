/**
 * Session Store - File-based persistence for test sessions
 * 
 * Provides reliable, crash-safe storage of session state with
 * immutable updates and comprehensive error handling.
 */

import { promises as fs } from 'fs';
import { createReadStream, createWriteStream } from 'fs';
import { join, dirname, basename } from 'path';
import { createHash } from 'crypto';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { logger } from '@babayaga/shared';
import {
  TestSession,
  SessionStatus,
  SessionStoreConfig,
  SessionQuery,
  SessionError,
  HoneypotError
} from './types.js';

export class SessionStore {
  private config: Required<SessionStoreConfig>;
  private activeSession: Map<string, TestSession> = new Map();
  private fileLocks = new Set<string>(); // Track locked files for concurrent access
  private readonly COMPRESSION_THRESHOLD = 1024 * 1024; // 1MB
  private readonly MAX_BACKUP_COUNT = 10;

  constructor(config: Partial<SessionStoreConfig> = {}) {
    this.config = {
      dataDir: config.dataDir || join(process.cwd(), 'babayaga-honeypot', 'data', 'sessions'),
      autoSave: true,
      backupEnabled: true,
      compressionEnabled: true,
      ...config
    };
  }

  async initialize(): Promise<void> {
    try {
      await this.ensureDirectories();
      await this.loadActiveSessions();
      logger.info('SessionStore initialized', {
        dataDir: this.config.dataDir,
        activeSessionCount: this.activeSession.size
      });
    } catch (error) {
      logger.error('Failed to initialize SessionStore', {}, error as Error);
      throw new HoneypotError('SessionStore initialization failed', 'INIT_ERROR', { error });
    }
  }

  // ============================================================================
  // SESSION CREATION AND RETRIEVAL
  // ============================================================================

  async createSession(session: TestSession): Promise<TestSession> {
    try {
      // Validate session
      this.validateSession(session);

      // Check for duplicate session ID
      if (await this.sessionExists(session.sessionId)) {
        throw new SessionError(
          `Session with ID ${session.sessionId} already exists`,
          session.sessionId
        );
      }

      // Add to active sessions
      this.activeSession.set(session.sessionId, { ...session });

      // Persist to disk
      await this.saveSession(session);

      logger.info('Session created', {
        sessionId: session.sessionId,
        agentId: session.agentId,
        checklistId: session.checklistId,
        itemCount: session.items.length
      });

      return { ...session };
    } catch (error) {
      logger.error('Failed to create session', { sessionId: session.sessionId }, error as Error);
      throw error instanceof SessionError ? error : new SessionError(
        `Failed to create session: ${(error as Error).message}`,
        session.sessionId,
        { originalError: error }
      );
    }
  }

  async getSession(sessionId: string): Promise<TestSession | null> {
    try {
      // Check active sessions first
      const activeSession = this.activeSession.get(sessionId);
      if (activeSession) {
        return { ...activeSession };
      }

      // Load from disk
      const session = await this.loadSession(sessionId);
      if (session) {
        // Cache in active sessions if still active
        if (session.status === 'active') {
          this.activeSession.set(sessionId, { ...session });
        }
        return { ...session };
      }

      return null;
    } catch (error) {
      logger.error('Failed to get session', { sessionId }, error as Error);
      throw new SessionError(
        `Failed to retrieve session: ${(error as Error).message}`,
        sessionId,
        { originalError: error }
      );
    }
  }

  async updateSession(sessionId: string, updates: Partial<TestSession>): Promise<TestSession> {
    try {
      const currentSession = await this.getSession(sessionId);
      if (!currentSession) {
        throw new SessionError(`Session ${sessionId} not found`, sessionId);
      }

      // Create updated session (immutable update)
      const updatedSession: TestSession = {
        ...currentSession,
        ...updates,
        sessionId, // Ensure ID cannot be changed
        // Deep merge for nested objects
        metadata: {
          ...currentSession.metadata,
          ...updates.metadata
        },
        globalEvidence: {
          ...currentSession.globalEvidence,
          ...updates.globalEvidence,
          metadata: {
            ...currentSession.globalEvidence.metadata,
            ...updates.globalEvidence?.metadata
          }
        }
      };

      // Update active sessions
      this.activeSession.set(sessionId, { ...updatedSession });

      // Persist to disk
      await this.saveSession(updatedSession);

      logger.debug('Session updated', {
        sessionId,
        updatedFields: Object.keys(updates),
        status: updatedSession.status
      });

      return { ...updatedSession };
    } catch (error) {
      logger.error('Failed to update session', { sessionId }, error as Error);
      throw error instanceof SessionError ? error : new SessionError(
        `Failed to update session: ${(error as Error).message}`,
        sessionId,
        { originalError: error }
      );
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      // Create backup if enabled
      if (this.config.backupEnabled) {
        await this.createBackup(session);
      }

      // Remove from active sessions
      this.activeSession.delete(sessionId);

      // Delete from disk
      const sessionPath = this.getSessionPath(sessionId);
      await fs.unlink(sessionPath);

      logger.info('Session deleted', { sessionId });
      return true;
    } catch (error) {
      logger.error('Failed to delete session', { sessionId }, error as Error);
      throw new SessionError(
        `Failed to delete session: ${(error as Error).message}`,
        sessionId,
        { originalError: error }
      );
    }
  }

  // ============================================================================
  // SESSION QUERYING
  // ============================================================================

  async querySessions(query: SessionQuery = {}): Promise<TestSession[]> {
    try {
      const sessions = await this.loadAllSessions();
      return sessions.filter(session => this.matchesQuery(session, query));
    } catch (error) {
      logger.error('Failed to query sessions', { query }, error as Error);
      throw new HoneypotError(
        `Failed to query sessions: ${(error as Error).message}`,
        'QUERY_ERROR',
        { query, originalError: error }
      );
    }
  }

  async getActiveSessions(): Promise<TestSession[]> {
    return this.querySessions({ status: 'active' });
  }

  async getSessionsByAgent(agentId: string): Promise<TestSession[]> {
    return this.querySessions({ agentId });
  }

  // ============================================================================
  // SESSION STATUS MANAGEMENT
  // ============================================================================

  async markSessionCompleted(sessionId: string): Promise<TestSession> {
    return this.updateSession(sessionId, {
      status: 'completed',
      endTime: new Date().toISOString()
    });
  }

  async markSessionFailed(sessionId: string, reason?: string): Promise<TestSession> {
    return this.updateSession(sessionId, {
      status: 'failed',
      endTime: new Date().toISOString(),
      metadata: {
        failureReason: reason
      }
    });
  }

  async markSessionCancelled(sessionId: string, reason?: string): Promise<TestSession> {
    return this.updateSession(sessionId, {
      status: 'cancelled',
      endTime: new Date().toISOString(),
      metadata: {
        cancellationReason: reason
      }
    });
  }

  // ============================================================================
  // ENHANCED PERSISTENCE OPERATIONS
  // ============================================================================

  private async saveSession(session: TestSession): Promise<void> {
    const sessionPath = this.getSessionPath(session.sessionId);
    const lockKey = `save_${session.sessionId}`;
    
    // File locking for concurrent access
    if (this.fileLocks.has(lockKey)) {
      throw new SessionError(`Session ${session.sessionId} is currently being saved`, session.sessionId);
    }
    
    this.fileLocks.add(lockKey);
    
    try {
      // Create incremental backup before saving
      if (this.config.backupEnabled) {
        await this.createIncrementalBackup(session);
      }

      const sessionData = JSON.stringify(session, null, 2);
      const dataSize = Buffer.byteLength(sessionData, 'utf8');
      
      // Determine if compression is needed
      const shouldCompress = this.config.compressionEnabled && dataSize > this.COMPRESSION_THRESHOLD;
      const finalPath = shouldCompress ? `${sessionPath}.gz` : sessionPath;
      const tempPath = `${finalPath}.tmp`;
      
      try {
        if (shouldCompress) {
          // Compressed save
          await this.saveCompressed(sessionData, tempPath);
          logger.debug('Session saved with compression', {
            sessionId: session.sessionId,
            originalSize: dataSize,
            compressionRatio: await this.getCompressionRatio(sessionData, tempPath)
          });
        } else {
          // Regular atomic write
          await fs.writeFile(tempPath, sessionData, { encoding: 'utf8' });
        }
        
        // Atomic rename
        await fs.rename(tempPath, finalPath);
        
        // Store metadata for tracking
        await this.updateSessionMetadata(session.sessionId, {
          size: dataSize,
          compressed: shouldCompress,
          lastSaved: new Date().toISOString(),
          checksum: this.calculateChecksum(sessionData)
        });
        
      } catch (error) {
        // Clean up temp file if write failed
        try {
          await fs.unlink(tempPath);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        throw error;
      }
    } finally {
      this.fileLocks.delete(lockKey);
    }
  }

  private async loadSession(sessionId: string): Promise<TestSession | null> {
    try {
      const lockKey = `load_${sessionId}`;
      
      // File locking for concurrent access
      if (this.fileLocks.has(lockKey)) {
        // Wait a bit and retry
        await new Promise(resolve => setTimeout(resolve, 100));
        if (this.fileLocks.has(lockKey)) {
          throw new SessionError(`Session ${sessionId} is currently being loaded`, sessionId);
        }
      }
      
      this.fileLocks.add(lockKey);
      
      try {
        const sessionPath = this.getSessionPath(sessionId);
        const compressedPath = `${sessionPath}.gz`;
        
        let sessionData: string;
        
        // Try compressed version first
        if (await this.fileExists(compressedPath)) {
          sessionData = await this.loadCompressed(compressedPath);
          logger.debug('Session loaded from compressed file', { sessionId });
        } else if (await this.fileExists(sessionPath)) {
          sessionData = await fs.readFile(sessionPath, 'utf8');
          logger.debug('Session loaded from regular file', { sessionId });
        } else {
          return null;
        }
        
        const session = JSON.parse(sessionData) as TestSession;
        
        // Verify checksum if available
        await this.verifySessionIntegrity(sessionId, sessionData);
        
        return session;
      } finally {
        this.fileLocks.delete(lockKey);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  // ============================================================================
  // COMPRESSION UTILITIES
  // ============================================================================

  private async saveCompressed(data: string, filePath: string): Promise<void> {
    const readStream = createReadStream(Buffer.from(data));
    const writeStream = createWriteStream(filePath);
    const gzipStream = createGzip({ level: 6 }); // Good balance of speed vs compression
    
    await pipeline(readStream, gzipStream, writeStream);
  }

  private async loadCompressed(filePath: string): Promise<string> {
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
    
    return Buffer.concat(chunks).toString('utf8');
  }

  private async getCompressionRatio(originalData: string, compressedPath: string): Promise<number> {
    try {
      const originalSize = Buffer.byteLength(originalData, 'utf8');
      const { size: compressedSize } = await fs.stat(compressedPath);
      return compressedSize / originalSize;
    } catch {
      return 1; // No compression if calculation fails
    }
  }

  // ============================================================================
  // INCREMENTAL BACKUP SYSTEM
  // ============================================================================

  private async createIncrementalBackup(session: TestSession): Promise<void> {
    if (!this.config.backupEnabled) return;

    try {
      const backupDir = join(this.config.dataDir, 'backups', session.sessionId);
      await this.ensureDirectory(backupDir);
      
      // Check if session already exists for incremental backup
      const existingSession = await this.loadSession(session.sessionId);
      if (!existingSession) {
        // First backup - create full backup
        await this.createFullBackup(session, backupDir);
      } else {
        // Incremental backup - only if session changed significantly
        if (this.hasSignificantChanges(existingSession, session)) {
          await this.createVersionedBackup(session, backupDir);
        }
      }
      
      // Cleanup old backups
      await this.cleanupOldBackups(backupDir);
      
    } catch (error) {
      logger.warn('Failed to create incremental backup', {
        sessionId: session.sessionId
      }, error as Error);
    }
  }

  private async createFullBackup(session: TestSession, backupDir: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(backupDir, `full-${timestamp}.json`);
    
    await fs.writeFile(backupPath, JSON.stringify(session, null, 2), 'utf8');
    
    logger.debug('Full backup created', {
      sessionId: session.sessionId,
      backupPath
    });
  }

  private async createVersionedBackup(session: TestSession, backupDir: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(backupDir, `version-${timestamp}.json`);
    
    // Create backup with metadata about changes
    const backupData = {
      timestamp: new Date().toISOString(),
      session,
      metadata: {
        itemCount: session.items.length,
        completedItems: session.items.filter(item => 
          item.status === 'passed' || item.status === 'failed' || item.status === 'skipped'
        ).length,
        evidenceCount: session.items.reduce((sum, item) => 
          sum + item.evidence.logs.length + item.evidence.toolCalls.length, 0
        )
      }
    };
    
    await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2), 'utf8');
    
    logger.debug('Versioned backup created', {
      sessionId: session.sessionId,
      backupPath
    });
  }

  private hasSignificantChanges(oldSession: TestSession, newSession: TestSession): boolean {
    // Check for significant changes that warrant a backup
    const oldCompleted = oldSession.items.filter(item => 
      item.status === 'passed' || item.status === 'failed' || item.status === 'skipped'
    ).length;
    
    const newCompleted = newSession.items.filter(item => 
      item.status === 'passed' || item.status === 'failed' || item.status === 'skipped'
    ).length;
    
    // Backup if:
    // 1. Status changed
    // 2. New items completed
    // 3. Significant evidence added (>10 new log entries or tool calls)
    const oldEvidenceCount = oldSession.items.reduce((sum, item) => 
      sum + item.evidence.logs.length + item.evidence.toolCalls.length, 0
    );
    
    const newEvidenceCount = newSession.items.reduce((sum, item) => 
      sum + item.evidence.logs.length + item.evidence.toolCalls.length, 0
    );
    
    return oldSession.status !== newSession.status ||
           oldCompleted !== newCompleted ||
           (newEvidenceCount - oldEvidenceCount) > 10;
  }

  private async cleanupOldBackups(backupDir: string): Promise<void> {
    try {
      const files = await fs.readdir(backupDir);
      const backupFiles = files
        .filter(file => file.endsWith('.json'))
        .map(file => join(backupDir, file));
      
      if (backupFiles.length > this.MAX_BACKUP_COUNT) {
        // Get file stats and sort by creation time
        const fileStats = await Promise.all(
          backupFiles.map(async file => ({
            path: file,
            stat: await fs.stat(file)
          }))
        );
        
        fileStats.sort((a, b) => a.stat.mtime.getTime() - b.stat.mtime.getTime());
        
        // Remove oldest files
        const filesToRemove = fileStats.slice(0, fileStats.length - this.MAX_BACKUP_COUNT);
        await Promise.all(filesToRemove.map(file => fs.unlink(file.path)));
        
        logger.debug('Cleaned up old backups', {
          backupDir,
          removedCount: filesToRemove.length
        });
      }
    } catch (error) {
      logger.warn('Failed to cleanup old backups', { backupDir }, error as Error);
    }
  }

  // ============================================================================
  // INTEGRITY AND METADATA
  // ============================================================================

  private calculateChecksum(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  private async updateSessionMetadata(sessionId: string, metadata: any): Promise<void> {
    try {
      const metadataDir = join(this.config.dataDir, '.metadata');
      await this.ensureDirectory(metadataDir);
      
      const metadataPath = join(metadataDir, `${sessionId}.json`);
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    } catch (error) {
      logger.warn('Failed to update session metadata', { sessionId }, error as Error);
    }
  }

  private async verifySessionIntegrity(sessionId: string, sessionData: string): Promise<void> {
    try {
      const metadataPath = join(this.config.dataDir, '.metadata', `${sessionId}.json`);
      
      if (await this.fileExists(metadataPath)) {
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
        const currentChecksum = this.calculateChecksum(sessionData);
        
        if (metadata.checksum && metadata.checksum !== currentChecksum) {
          logger.warn('Session integrity check failed', {
            sessionId,
            expectedChecksum: metadata.checksum,
            actualChecksum: currentChecksum
          });
        }
      }
    } catch (error) {
      logger.debug('Could not verify session integrity', { 
        sessionId, 
        error: (error as Error).message 
      });
    }
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  private async loadAllSessions(): Promise<TestSession[]> {
    try {
      const files = await fs.readdir(this.config.dataDir);
      const sessionFiles = files.filter(file => file.endsWith('.json'));
      
      const sessions: TestSession[] = [];
      for (const file of sessionFiles) {
        try {
          const sessionPath = join(this.config.dataDir, file);
          const sessionData = await fs.readFile(sessionPath, 'utf8');
          const session = JSON.parse(sessionData) as TestSession;
          sessions.push(session);
        } catch (error) {
          logger.warn('Failed to load session file', { file }, error as Error);
        }
      }
      
      return sessions;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  private async loadActiveSessions(): Promise<void> {
    const sessions = await this.loadAllSessions();
    for (const session of sessions) {
      if (session.status === 'active') {
        this.activeSession.set(session.sessionId, session);
      }
    }
  }

  private async sessionExists(sessionId: string): Promise<boolean> {
    try {
      const sessionPath = this.getSessionPath(sessionId);
      await fs.access(sessionPath);
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // BACKUP AND RECOVERY
  // ============================================================================

  private async createBackup(session: TestSession): Promise<void> {
    if (!this.config.backupEnabled) return;

    try {
      const backupDir = join(this.config.dataDir, 'backups');
      await this.ensureDirectory(backupDir);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = join(backupDir, `${session.sessionId}-${timestamp}.json`);
      
      await fs.writeFile(backupPath, JSON.stringify(session, null, 2), 'utf8');
      
      logger.debug('Session backup created', {
        sessionId: session.sessionId,
        backupPath
      });
    } catch (error) {
      logger.warn('Failed to create session backup', {
        sessionId: session.sessionId
      }, error as Error);
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private getSessionPath(sessionId: string): string {
    return join(this.config.dataDir, `${sessionId}.json`);
  }

  private async ensureDirectories(): Promise<void> {
    await this.ensureDirectory(this.config.dataDir);
    if (this.config.backupEnabled) {
      await this.ensureDirectory(join(this.config.dataDir, 'backups'));
    }
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

  private validateSession(session: TestSession): void {
    if (!session.sessionId?.trim()) {
      throw new SessionError('Session ID is required', session.sessionId || '');
    }
    if (!session.agentId?.trim()) {
      throw new SessionError('Agent ID is required', session.sessionId);
    }
    if (!session.checklistId?.trim()) {
      throw new SessionError('Checklist ID is required', session.sessionId);
    }
    if (!Array.isArray(session.items)) {
      throw new SessionError('Session items must be an array', session.sessionId);
    }
  }

  private matchesQuery(session: TestSession, query: SessionQuery): boolean {
    if (query.agentId && session.agentId !== query.agentId) return false;
    if (query.status && session.status !== query.status) return false;
    if (query.checklistId && session.checklistId !== query.checklistId) return false;
    
    if (query.startTimeFrom && session.startTime < query.startTimeFrom) return false;
    if (query.startTimeTo && session.startTime > query.startTimeTo) return false;
    
    if (query.tags && query.tags.length > 0) {
      const sessionTags = session.metadata.tags || [];
      if (!query.tags.some(tag => sessionTags.includes(tag))) return false;
    }
    
    return true;
  }

  // ============================================================================
  // CLEANUP AND MAINTENANCE
  // ============================================================================

  async cleanup(): Promise<void> {
    try {
      // Clear active sessions
      this.activeSession.clear();
      logger.info('SessionStore cleanup completed');
    } catch (error) {
      logger.error('SessionStore cleanup failed', {}, error as Error);
    }
  }

  // ============================================================================
  // METRICS AND MONITORING
  // ============================================================================

  getMetrics() {
    return {
      activeSessionCount: this.activeSession.size,
      dataDirectory: this.config.dataDir,
      autoSaveEnabled: this.config.autoSave,
      backupEnabled: this.config.backupEnabled
    };
  }
}