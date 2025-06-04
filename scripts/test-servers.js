#!/usr/bin/env node

import { spawn } from 'child_process';
import { createInterface } from 'readline';

async function testPuppeteerMCP() {
  console.log('🧪 Testing Puppeteer MCP Server...');
  
  const server = spawn('node_modules/.bin/mcp-server-puppeteer', [], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Send a simple JSON-RPC request to list tools
  const request = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 1
  }) + '\n';

  server.stdin.write(request);

  // Read response
  const rl = createInterface({
    input: server.stdout,
    crlfDelay: Infinity
  });

  return new Promise((resolve, reject) => {
    let responseReceived = false;
    
    rl.on('line', (line) => {
      if (!responseReceived) {
        try {
          const response = JSON.parse(line);
          console.log('✅ Puppeteer MCP Response:', JSON.stringify(response, null, 2));
          responseReceived = true;
          server.kill();
          resolve(true);
        } catch (e) {
          // Might be a log line, ignore
        }
      }
    });

    server.stderr.on('data', (data) => {
      console.error('Puppeteer MCP Error:', data.toString());
    });

    server.on('exit', (code) => {
      if (!responseReceived) {
        reject(new Error(`Server exited with code ${code} without response`));
      }
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!responseReceived) {
        server.kill();
        reject(new Error('Timeout waiting for response'));
      }
    }, 5000);
  });
}

async function testCDPMCP() {
  console.log('\n🧪 Testing CDP MCP Server...');
  
  const server = spawn('node_modules/.bin/tsx', ['src/cdp-mcp-server/index.ts'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Send a simple JSON-RPC request to list tools
  const request = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 1
  }) + '\n';

  server.stdin.write(request);

  // Read response
  const rl = createInterface({
    input: server.stdout,
    crlfDelay: Infinity
  });

  return new Promise((resolve, reject) => {
    let responseReceived = false;
    
    rl.on('line', (line) => {
      if (!responseReceived) {
        try {
          const response = JSON.parse(line);
          console.log('✅ CDP MCP Response:', JSON.stringify(response, null, 2));
          responseReceived = true;
          server.kill();
          resolve(true);
        } catch (e) {
          // Might be a log line, ignore
        }
      }
    });

    server.stderr.on('data', (data) => {
      console.error('CDP MCP Error:', data.toString());
    });

    server.on('exit', (code) => {
      if (!responseReceived) {
        reject(new Error(`Server exited with code ${code} without response`));
      }
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!responseReceived) {
        server.kill();
        reject(new Error('Timeout waiting for response'));
      }
    }, 5000);
  });
}

async function main() {
  console.log('🔮 BabaYaga MCP Server Test Suite\n');

  try {
    await testPuppeteerMCP();
  } catch (error) {
    console.error('❌ Puppeteer MCP Test Failed:', error.message);
  }

  try {
    await testCDPMCP();
  } catch (error) {
    console.error('❌ CDP MCP Test Failed:', error.message);
  }

  console.log('\n✨ Test complete!');
}

main().catch(console.error);