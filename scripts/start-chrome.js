#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import { platform } from 'os';
import { existsSync } from 'fs';
import { join } from 'path';

const CHROME_PATHS = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Chromium\\Application\\chrome.exe',
  ],
  linux: [
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ],
};

function findChrome() {
  const paths = CHROME_PATHS[platform()] || CHROME_PATHS.linux;
  
  for (const path of paths) {
    try {
      if (platform() === 'win32') {
        if (existsSync(path)) return path;
      } else {
        // Try to find in PATH
        execSync(`which "${path}"`, { stdio: 'ignore' });
        return path;
      }
    } catch (e) {
      // Continue to next path
    }
  }
  
  throw new Error(`Chrome/Chromium not found. Please install Chrome or set CHROME_PATH environment variable.`);
}

async function startChrome() {
  console.log('🌐 Starting Chrome with remote debugging...');
  
  // Kill any existing Chrome debug instances
  try {
    if (platform() === 'win32') {
      execSync('taskkill /F /IM chrome.exe /T 2>nul', { stdio: 'ignore' });
    } else {
      execSync('pkill -f "chrome.*remote-debugging-port=9222" 2>/dev/null', { stdio: 'ignore' });
    }
  } catch (e) {
    // Ignore errors if no Chrome process found
  }
  
  const chromePath = process.env.CHROME_PATH || findChrome();
  console.log(`📍 Using Chrome at: ${chromePath}`);
  
  const args = [
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:8888',
  ];
  
  // Platform-specific args
  if (platform() === 'linux') {
    args.push('--disable-gpu', '--disable-software-rasterizer');
  }
  
  // User data directory
  const userDataDir = platform() === 'win32' 
    ? join(process.env.TEMP || 'C:\\temp', 'chrome-debug-babayaga')
    : '/tmp/chrome-debug-babayaga';
  args.unshift(`--user-data-dir=${userDataDir}`);
  
  // Start Chrome
  const chrome = spawn(chromePath, args, {
    detached: true,
    stdio: 'ignore',
  });
  
  chrome.unref();
  
  console.log('⏳ Waiting for Chrome to start...');
  
  // Wait for Chrome to be ready
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    try {
      const response = await fetch('http://localhost:9222/json/version');
      if (response.ok) {
        const version = await response.json();
        console.log('✅ Chrome started successfully with remote debugging on port 9222');
        console.log(`📍 Browser: ${version.Browser}`);
        console.log('📍 Chrome will open the test app at http://localhost:8888');
        return;
      }
    } catch (e) {
      // Chrome not ready yet
    }
    
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.error('❌ Failed to start Chrome with remote debugging');
  process.exit(1);
}

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('Error:', err);
  process.exit(1);
});

startChrome().catch(console.error);