#!/usr/bin/env node

import { spawn } from 'child_process';
import { platform } from 'os';

console.log('🔮 Starting BabaYaga - Agentic Web Refinement Cauldron');
console.log('======================================================');

const processes = [];

// Function to handle cleanup on exit
function cleanup() {
  console.log('\n\n🛑 Shutting down all services...');
  processes.forEach(proc => {
    try {
      if (platform() === 'win32') {
        spawn('taskkill', ['/pid', proc.pid, '/f', '/t']);
      } else {
        proc.kill();
      }
    } catch (e) {
      // Ignore errors
    }
  });
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

async function checkChrome() {
  try {
    const response = await fetch('http://localhost:9222/json/version');
    if (response.ok) {
      console.log('✅ Chrome remote debugging detected on port 9222');
      return true;
    }
  } catch (e) {
    // Chrome not running
  }
  
  console.log('⚠️  Chrome is not running with remote debugging enabled!');
  console.log('Please start Chrome with:');
  console.log('');
  console.log('npm run chrome');
  console.log('');
  return false;
}

async function startServices() {
  // Check Chrome first
  const chromeReady = await checkChrome();
  if (!chromeReady) {
    process.exit(1);
  }
  
  console.log('');
  
  // Start test app
  console.log('🌐 Starting test application on http://localhost:8888...');
  const testApp = spawn('npm', ['run', 'serve:test-app'], {
    stdio: 'inherit',
    shell: true,
  });
  processes.push(testApp);
  
  // Wait a moment for test app to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Start Puppeteer MCP server
  console.log('🤖 Starting Puppeteer MCP server...');
  const puppeteerMcp = spawn('npm', ['run', 'start:puppeteer-mcp'], {
    stdio: 'inherit',
    shell: true,
  });
  processes.push(puppeteerMcp);
  
  // Start CDP MCP server
  console.log('🔧 Starting CDP MCP server...');
  const cdpMcp = spawn('npm', ['run', 'start:cdp-mcp'], {
    stdio: 'inherit',
    shell: true,
  });
  processes.push(cdpMcp);
  
  console.log('');
  console.log('✨ All services are starting up!');
  console.log('');
  console.log('📝 Next steps:');
  console.log('1. Configure Claude Code with:');
  console.log('   claude mcp add puppeteer-babayaga stdio "npm" "run" "start:puppeteer-mcp"');
  console.log('   claude mcp add cdp-babayaga stdio "npm" "run" "start:cdp-mcp"');
  console.log('');
  console.log('2. Test app is available at: http://localhost:8888');
  console.log('');
  console.log('Press Ctrl+C to stop all services');
  console.log('');
}

startServices().catch(console.error);