#!/usr/bin/env node

import { UnifiedBabaYaga } from './UnifiedBabaYaga.js';

async function main() {
  const config: any = {
    headless: process.env.HEADLESS === 'true',
    screenshotPath: process.env.SCREENSHOT_PATH || './screenshots',
  };
  
  // Only add optional properties if they have values
  if (process.env.BROWSER_ARGS) {
    config.browserArgs = process.env.BROWSER_ARGS.split(',');
  }
  if (process.env.START_URL) {
    config.startUrl = process.env.START_URL;
  }
  
  const babayaga = new UnifiedBabaYaga(config);

  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.log('\n⚡ Received SIGINT, shutting down gracefully...');
    await babayaga.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n⚡ Received SIGTERM, shutting down gracefully...');
    await babayaga.shutdown();
    process.exit(0);
  });

  // Handle uncaught errors
  process.on('uncaughtException', async (error) => {
    console.error('💥 Uncaught exception:', error);
    await babayaga.shutdown();
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
    await babayaga.shutdown();
    process.exit(1);
  });

  // Start the server
  try {
    await babayaga.start();
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

export { UnifiedBabaYaga } from './UnifiedBabaYaga.js';
export * from './types/index.js';