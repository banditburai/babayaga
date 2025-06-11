import { z } from 'zod';

// Constants
export const TOOL_NAMES = {
  CDP_SEND_COMMAND: 'cdp_send_command',
  CDP_LIST_TARGETS: 'cdp_list_targets',
  CDP_CONNECT_TARGET: 'cdp_connect_target',
  CDP_HEALTH_CHECK: 'cdp_health_check',
  CDP_SYNC_PLAYWRIGHT: 'cdp_sync_playwright',
  // Measurement tools
  QA_MEASURE_ELEMENT: 'qa_measure_element',
  QA_MEASURE_DISTANCES: 'qa_measure_distances',
  QA_ANALYZE_LAYOUT_GRID: 'qa_analyze_layout_grid',
} as const;

export const RESOURCE_URIS = {
  CONNECTION_STATUS: 'cdp://connection-status',
} as const;

export const DEFAULT_CONFIG = {
  CONNECTION_TIMEOUT: 10_000,
  COMMAND_TIMEOUT: 30_000,
  RECONNECT_ATTEMPTS: 3,
  RECONNECT_DELAY: 1_000,
} as const;

export const DEFAULT_OUTPUT_DIR = './cdp-output';

// Error schema (extracted for reusability)
const CDPErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().optional(),
});

// CDP Command schema with improved typing
export const CDPCommandSchema = z.object({
  id: z.number(),
  method: z.string(),
  params: z.record(z.unknown()).optional(),
});

export type CDPCommand = z.infer<typeof CDPCommandSchema>;
export type CDPError = z.infer<typeof CDPErrorSchema>;

// CDP Response schema
export const CDPResponseSchema = z.object({
  id: z.number(),
  result: z.unknown().optional(),
  error: CDPErrorSchema.optional(),
});

export type CDPResponse = z.infer<typeof CDPResponseSchema>;

// CDP Event schema
export const CDPEventSchema = z.object({
  method: z.string(),
  params: z.unknown(),
});

export type CDPEvent = z.infer<typeof CDPEventSchema>;

// CDP Target schema
export const CDPTargetSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  url: z.string(),
  webSocketDebuggerUrl: z.string(),
});

export type CDPTarget = z.infer<typeof CDPTargetSchema>;

// MCP tool input schemas
export const CDPCommandInputSchema = z.object({
  method: z.string().describe('CDP command name (e.g., "Page.navigate", "Runtime.evaluate")'),
  params: z.record(z.unknown()).optional().describe('Parameters for the CDP command'),
});

export const EmptyInputSchema = z.object({}).strict();
export const ListTargetsInputSchema = EmptyInputSchema;

export const ConnectTargetInputSchema = z.object({
  targetId: z.string().optional().describe('Target ID to connect to. If not provided, connects to the first available target'),
});

export const SyncPlaywrightInputSchema = z.object({
  playwrightCdpUrl: z.string().optional().describe('Playwright CDP URL (e.g., "http://localhost:9222"). If not provided, will try to detect from common ports'),
});

// Tool response type
export type ToolResponse = {
  content: Array<{ type: 'text'; text: string }>;
};

// Server configuration
export interface ServerConfig {
  cdpUrl: string;
  connectionTimeout?: number;
  commandTimeout?: number;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  outputDir?: string;
}

// Tool definitions
export const TOOL_DEFINITIONS = [
  {
    name: TOOL_NAMES.CDP_SEND_COMMAND,
    description: 'Send a Chrome DevTools Protocol command to the connected browser',
    inputSchema: {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          description: 'CDP command name (e.g., "Page.navigate", "Runtime.evaluate")',
        },
        params: {
          type: 'object',
          description: 'Parameters for the CDP command',
        },
      },
      required: ['method'],
    },
  },
  {
    name: TOOL_NAMES.CDP_LIST_TARGETS,
    description: 'List all available Chrome DevTools Protocol targets',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: TOOL_NAMES.CDP_CONNECT_TARGET,
    description: 'Connect to a specific CDP target or the first available one',
    inputSchema: {
      type: 'object',
      properties: {
        targetId: {
          type: 'string',
          description: 'Target ID to connect to. If not provided, connects to the first available target',
        },
      },
    },
  },
  {
    name: TOOL_NAMES.CDP_HEALTH_CHECK,
    description: 'Perform comprehensive health check of CDP server and browser connection',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: TOOL_NAMES.CDP_SYNC_PLAYWRIGHT,
    description: 'Synchronize CDP connection with Playwright browser instance and enable required domains',
    inputSchema: {
      type: 'object',
      properties: {
        playwrightCdpUrl: {
          type: 'string',
          description: 'Playwright CDP URL (e.g., "http://localhost:9222"). If not provided, will try to detect from common ports',
        },
      },
    },
  },
  // Measurement tools
  {
    name: TOOL_NAMES.QA_MEASURE_ELEMENT,
    description: 'Measure comprehensive dimensions and properties of an element including box model, typography, spacing, and visibility',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the element to measure',
        },
        includeTypography: {
          type: 'boolean',
          description: 'Include typography measurements',
          default: true,
        },
        includeBoxModel: {
          type: 'boolean',
          description: 'Include box model measurements',
          default: true,
        },
      },
      required: ['selector'],
    },
  },
  {
    name: TOOL_NAMES.QA_MEASURE_DISTANCES,
    description: 'Calculate precise distances and spatial relationships between two design elements',
    inputSchema: {
      type: 'object',
      properties: {
        elementA: {
          type: 'string',
          description: 'CSS selector for the first element',
        },
        elementB: {
          type: 'string',
          description: 'CSS selector for the second element',
        },
      },
      required: ['elementA', 'elementB'],
    },
  },
  {
    name: TOOL_NAMES.QA_ANALYZE_LAYOUT_GRID,
    description: 'Analyze spacing consistency and grid alignment for a set of elements',
    inputSchema: {
      type: 'object',
      properties: {
        elements: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Array of CSS selectors for elements to analyze',
        },
        tolerancePixels: {
          type: 'number',
          description: 'Pixel tolerance for alignment detection',
          default: 2,
        },
      },
      required: ['elements'],
    },
  },
] as const;