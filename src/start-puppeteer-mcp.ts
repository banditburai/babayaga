#!/usr/bin/env tsx
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('Starting Puppeteer MCP Server...');
  
  // Use the puppeteer-mcp-server binary directly
  const serverPath = join(__dirname, '../node_modules/.bin/mcp-server-puppeteer');
  
  const server = spawn(serverPath, [], {
    stdio: 'inherit',
    env: {
      ...process.env,
      // Add any environment variables if needed
    },
  });

  server.on('error', (error) => {
    console.error('Failed to start Puppeteer MCP Server:', error);
    process.exit(1);
  });

  server.on('exit', (code) => {
    console.log(`Puppeteer MCP Server exited with code ${code}`);
    process.exit(code || 0);
  });

  console.log('Puppeteer MCP Server is running');
  console.log('Press Ctrl+C to stop the server');

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down Puppeteer MCP Server...');
    server.kill();
    process.exit(0);
  });
}

main().catch(console.error);