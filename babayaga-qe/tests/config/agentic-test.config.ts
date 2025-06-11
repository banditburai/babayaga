/**
 * Configuration for agentic testing through MCP server
 */

export interface AgenticTestConfig {
  mcpServer: {
    enabled: boolean;
    url?: string;
    timeout: number;
  };
  browser: {
    headless: boolean;
    cdpPort: number;
    viewport: {
      width: number;
      height: number;
    };
  };
  performance: {
    maxElementMeasurementTime: number;
    maxDistanceCalculationTime: number;
    maxGridAnalysisTimePerElement: number;
    maxMemoryIncreasePercentage: number;
  };
  retries: {
    maxRetries: number;
    retryDelay: number;
  };
}

export const defaultConfig: AgenticTestConfig = {
  mcpServer: {
    enabled: true,
    timeout: 30000, // 30 seconds
  },
  browser: {
    headless: false,
    cdpPort: 9222,
    viewport: {
      width: 1200,
      height: 800,
    },
  },
  performance: {
    maxElementMeasurementTime: 50, // ms
    maxDistanceCalculationTime: 30, // ms  
    maxGridAnalysisTimePerElement: 150, // ms
    maxMemoryIncreasePercentage: 10, // %
  },
  retries: {
    maxRetries: 3,
    retryDelay: 1000, // ms
  },
};

export function loadTestConfig(): AgenticTestConfig {
  // In the future, this could load from environment variables or config files
  return defaultConfig;
}