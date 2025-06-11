import { CDPMcpServer } from './cdp-mcp-server.js';
import { DEFAULT_CONFIG } from './types.js';
import { logger } from '@babayaga/shared';

const CDP_URL = process.env.CDP_URL || 'http://localhost:9222';

async function main() {
  try {
    const server = new CDPMcpServer({
      cdpUrl: CDP_URL,
      connectionTimeout: DEFAULT_CONFIG.CONNECTION_TIMEOUT,
      commandTimeout: DEFAULT_CONFIG.COMMAND_TIMEOUT,
      reconnectAttempts: DEFAULT_CONFIG.RECONNECT_ATTEMPTS,
      reconnectDelay: DEFAULT_CONFIG.RECONNECT_DELAY,
    });

    await server.start();
  } catch (error) {
    logger.fatal('Failed to start CDP MCP server', {}, error as Error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught exception', {}, error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal('Unhandled rejection', { 
    promise: promise.toString(),
    reason: String(reason)
  });
  process.exit(1);
});

// Run the server
main().catch((error) => {
  logger.fatal('Fatal error in main', {}, error as Error);
  process.exit(1);
});