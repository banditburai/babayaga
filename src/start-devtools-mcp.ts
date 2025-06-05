#!/usr/bin/env tsx
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('Starting DevTools MCP Server...');
  console.log('Make sure Chrome is running with --remote-debugging-port=9222');
  
  // Find the devtools-mcp package
  const devtoolsPath = join(__dirname, '../node_modules/devtools-mcp/src/index.ts');
  
  const server = spawn('tsx', [devtoolsPath], {
    stdio: 'inherit',
    env: {
      ...process.env,
      CHROME_DEBUG_PORT: '9222',
    },
  });

  server.on('error', (error) => {
    console.error('Failed to start DevTools MCP Server:', error);
    process.exit(1);
  });

  server.on('exit', (code) => {
    console.log(`DevTools MCP Server exited with code ${code}`);
    process.exit(code || 0);
  });

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down DevTools MCP Server...');
    server.kill();
    process.exit(0);
  });
}

main().catch(console.error);