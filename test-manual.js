#!/usr/bin/env node

import { spawn } from 'child_process';
import { createInterface } from 'readline';

console.log('🧪 Testing Unified BabaYaga MCP Server...\n');

// Start the server
const server = spawn('npm', ['start'], {
  stdio: ['pipe', 'pipe', 'inherit'],
  shell: true
});

// Create readline interface
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

// Handle server output
server.stdout.on('data', (data) => {
  console.log('Server:', data.toString().trim());
});

// Wait for server to start
setTimeout(() => {
  console.log('\n📝 Sending initialization request...\n');
  
  // Send initialization request
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '0.1.0',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  };
  
  server.stdin.write(JSON.stringify(initRequest) + '\n');
  
  // Send list tools request after init
  setTimeout(() => {
    console.log('\n📝 Requesting available tools...\n');
    
    const listToolsRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    };
    
    server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
    
    // Exit after a moment
    setTimeout(() => {
      console.log('\n✅ Test completed. Shutting down...');
      server.kill();
      process.exit(0);
    }, 2000);
  }, 1000);
}, 2000);

// Handle exit
process.on('SIGINT', () => {
  server.kill();
  process.exit(0);
});