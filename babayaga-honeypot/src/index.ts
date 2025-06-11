#!/usr/bin/env node

/**
 * Babayaga Honeypot MCP Server v2.0
 * Entry point for the simplified, robust agent testing validation server
 */

import { HoneypotMCPServer } from './mcp-server.js';
import { logger } from '@babayaga/shared';

// Set log level to ERROR to minimize logging for MCP compatibility
process.env.LOG_LEVEL = '4';

async function main() {
  const server = new HoneypotMCPServer();
  
  // Start the server
  await server.start();
  
  // Log server metrics periodically (optional)
  if (process.env.NODE_ENV !== 'production') {
    setInterval(() => {
      const metrics = server.getMetrics();
      logger.debug('Server metrics', metrics);
    }, 60000); // Every minute
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

main().catch((err) => {
  logger.error('Fatal error in honeypot server', err);
  process.exit(1);
});