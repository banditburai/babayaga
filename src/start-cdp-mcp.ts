#!/usr/bin/env tsx
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseArgs() {
  const args = process.argv.slice(2);
  const port = args.find(arg => arg.startsWith('--port='))?.split('=')[1] || '9222';
  return { port };
}

async function main() {
  const { port } = parseArgs();
  
  console.log(`Starting CDP MCP Server...`);
  console.log(`Expected Chrome remote debugging port: ${port}`);
  console.log('Make sure Chrome is running with --remote-debugging-port=' + port);
  
  // Start the CDP MCP server
  const serverPath = join(__dirname, 'cdp-mcp-server/index.ts');
  const server = spawn('tsx', [serverPath], {
    stdio: 'inherit',
    env: {
      ...process.env,
      CHROME_DEBUG_PORT: port,
    },
  });

  server.on('error', (error) => {
    console.error('Failed to start CDP MCP Server:', error);
    process.exit(1);
  });

  server.on('exit', (code) => {
    console.log(`CDP MCP Server exited with code ${code}`);
    process.exit(code || 0);
  });

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down CDP MCP Server...');
    server.kill();
    process.exit(0);
  });
}

main().catch(console.error);