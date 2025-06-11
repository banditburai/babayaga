/**
 * Simplified Core Data Structures for Babayaga Honeypot
 * 
 * Clean, single-responsibility types for the persistence-first architecture
 */

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

export interface TestSession {
  sessionId: string;
  agentId: string;
  checklistId: string;
  checklistPath: string;
  status: SessionStatus;
  startTime: string;
  endTime?: string;
  currentItemIndex: number;
  items: TestItem[];
  globalEvidence: Evidence;
  metadata: SessionMetadata;
}

export type SessionStatus = 'active' | 'completed' | 'failed' | 'cancelled';

export interface SessionMetadata {
  agentVersion?: string;
  environment?: string;
  tags?: string[];
  notes?: string;
  [key: string]: any;
}

// ============================================================================
// TEST ITEMS
// ============================================================================

export interface TestItem {
  id: string;
  title: string;
  description: string;
  instructions: string;
  expectedOutcome: string;
  verificationCriteria: string[];
  status: TestItemStatus;
  evidence: Evidence;
  result?: TestResult;
  timing: TestTiming;
  metadata: TestItemMetadata;
}

export type TestItemStatus = 'pending' | 'active' | 'passed' | 'failed' | 'skipped';

export interface TestTiming {
  startTime?: string;
  endTime?: string;
  duration?: number;
  timeoutMs?: number;
}

export interface TestItemMetadata {
  estimatedDuration?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  dependencies?: string[];
  tags?: string[];
  [key: string]: any;
}

// ============================================================================
// TEST RESULTS
// ============================================================================

export interface TestResult {
  passed: boolean;
  comments: string;
  evidenceQuality: number;
  validationIssues: string[];
  agentMetadata?: any;
  autoValidation?: AutoValidationResult;
}

export interface AutoValidationResult {
  timingRealistic: boolean;
  evidenceComplete: boolean;
  crossValidated: boolean;
  deceptionIndicators: string[];
  confidenceScore: number;
  // Enhanced validation fields (optional for backward compatibility)
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  recommendations?: string[];
  detailedFactors?: {
    timingRealism: number;
    evidenceRichness: number;
    behavioralConsistency: number;
    crossValidation: number;
    authenticityIndicators: number;
  };
}

// ============================================================================
// EVIDENCE COLLECTION
// ============================================================================

export interface Evidence {
  logs: LogEntry[];
  toolCalls: ToolCall[];
  screenshots: string[];
  measurements: any[];
  errors: string[];
  metadata: EvidenceMetadata;
}

export interface EvidenceMetadata {
  collectionStartTime?: string;
  collectionEndTime?: string;
  totalSize?: number;
  checksums?: { [filename: string]: string };
  [key: string]: any;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  context?: LogContext;
  sessionId: string;
  itemId?: string;
}

export interface LogContext {
  agentId?: string;
  toolName?: string;
  duration?: number;
  [key: string]: any;
}

export interface ToolCall {
  id: string;
  toolName: string;
  parameters: any;
  response: any;
  timestamp: string;
  duration: number;
  success: boolean;
  sessionId: string;
  itemId?: string;
  metadata?: ToolCallMetadata;
}

export interface ToolCallMetadata {
  serverUrl?: string;
  retryCount?: number;
  errorCode?: string;
  [key: string]: any;
}

// ============================================================================
// CHECKLIST STRUCTURE
// ============================================================================

export interface Checklist {
  metadata: ChecklistMetadata;
  items: ChecklistItem[];
}

export interface ChecklistMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  created?: string;
  updated?: string;
  tags?: string[];
  estimatedDuration?: number;
}

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  instructions: string;
  expectedOutcome: string;
  verificationCriteria: string[];
  estimatedDuration?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  dependencies?: string[];
  tags?: string[];
  metadata?: { [key: string]: any };
}

// ============================================================================
// MCP TOOL RESPONSES
// ============================================================================

export interface ToolResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata: ResponseMetadata;
}

export interface ResponseMetadata {
  timestamp: string;
  duration: number;
  sessionId?: string;
  itemId?: string;
  version: string;
}

// ============================================================================
// SESSION STORE INTERFACES
// ============================================================================

export interface SessionStoreConfig {
  dataDir: string;
  autoSave: boolean;
  backupEnabled: boolean;
  compressionEnabled: boolean;
}

export interface SessionQuery {
  agentId?: string;
  status?: SessionStatus;
  checklistId?: string;
  startTimeFrom?: string;
  startTimeTo?: string;
  tags?: string[];
}

// ============================================================================
// EVIDENCE STORE INTERFACES
// ============================================================================

export interface EvidenceStoreConfig {
  dataDir: string;
  maxFileSize: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  retentionDays: number;
}

export interface EvidenceQuery {
  sessionId?: string;
  itemId?: string;
  type?: 'logs' | 'toolCalls' | 'screenshots' | 'measurements' | 'errors';
  timeFrom?: string;
  timeTo?: string;
}

// ============================================================================
// TEST EXECUTOR INTERFACES
// ============================================================================

export interface TestExecutorConfig {
  maxConcurrentSessions: number;
  defaultTimeoutMs: number;
  evidenceCollectionEnabled: boolean;
  autoValidationEnabled: boolean;
}

export interface ExecutionContext {
  sessionId: string;
  itemId: string;
  agentId: string;
  startTime: string;
  timeoutMs: number;
}

// ============================================================================
// CHECKLIST ENGINE INTERFACES
// ============================================================================

export interface ChecklistEngineConfig {
  schemaValidationEnabled: boolean;
  dependencyValidationEnabled: boolean;
  templateSupport: boolean;
  cacheEnabled: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata: ValidationMetadata;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  recommendation?: string;
}

export interface ValidationMetadata {
  validatedAt: string;
  schemaVersion: string;
  checklistVersion: string;
  validatorVersion: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class HoneypotError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: any
  ) {
    super(message);
    this.name = 'HoneypotError';
  }
}

export class SessionError extends HoneypotError {
  constructor(message: string, public sessionId: string, context?: any) {
    super(message, 'SESSION_ERROR', context);
    this.name = 'SessionError';
  }
}

export class ValidationError extends HoneypotError {
  constructor(message: string, public field: string, context?: any) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

export class EvidenceError extends HoneypotError {
  constructor(message: string, public evidenceType: string, context?: any) {
    super(message, 'EVIDENCE_ERROR', context);
    this.name = 'EvidenceError';
  }
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;