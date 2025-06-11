/**
 * Shared types and interfaces for the Babayaga ecosystem
 */

// CDP Client interface shared across packages
export interface CDPClient {
  sendCommand(method: string, params?: any): Promise<any>;
  connect?(target?: string): Promise<void>;
  disconnect?(): Promise<void>;
}

// Measurement interfaces
export interface ElementDimensions {
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface MeasurementOptions {
  selector: string;
  includeTypography?: boolean;
  includeBoxModel?: boolean;
}

export interface MeasurementResult {
  dimensions: ElementDimensions;
  error?: string;
  timestamp: Date;
}

// System metrics for behavioral analysis
export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  networkLatency?: number;
  browserActiveConnections: number;
}

// Error types
export interface ValidationError {
  name: string;
  field: string;
  message: string;
  code: string;
  value?: any;
}