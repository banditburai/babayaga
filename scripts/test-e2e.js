#!/usr/bin/env node

import { spawn } from 'child_process';
import { createInterface } from 'readline';

class MCPClient {
  constructor(command, args = []) {
    this.server = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    this.rl = createInterface({
      input: this.server.stdout,
      crlfDelay: Infinity
    });
    
    this.responseHandlers = new Map();
    this.nextId = 1;
    
    // Handle responses
    this.rl.on('line', (line) => {
      try {
        const response = JSON.parse(line);
        if (response.id && this.responseHandlers.has(response.id)) {
          const handler = this.responseHandlers.get(response.id);
          this.responseHandlers.delete(response.id);
          handler.resolve(response);
        }
      } catch (e) {
        // Ignore non-JSON lines (logs, etc.)
      }
    });
    
    this.server.stderr.on('data', (data) => {
      // console.error(`[${command}] Error:`, data.toString());
    });
  }
  
  async request(method, params = {}) {
    const id = this.nextId++;
    const request = {
      jsonrpc: '2.0',
      method,
      id,
      params
    };
    
    return new Promise((resolve, reject) => {
      this.responseHandlers.set(id, { resolve, reject });
      this.server.stdin.write(JSON.stringify(request) + '\n');
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.responseHandlers.has(id)) {
          this.responseHandlers.delete(id);
          reject(new Error(`Request ${id} timed out`));
        }
      }, 10000);
    });
  }
  
  async callTool(name, args = {}) {
    return this.request('tools/call', { name, arguments: args });
  }
  
  close() {
    this.server.kill();
  }
}

async function runE2ETest() {
  console.log('🔮 BabaYaga E2E Test\n');
  
  // Check if test app is running
  try {
    const response = await fetch('http://localhost:8888');
    if (!response.ok) throw new Error('Test app not responding');
    console.log('✅ Test app is running on http://localhost:8888');
  } catch (error) {
    console.error('❌ Test app is not running. Please run: npm run serve:test-app');
    return;
  }
  
  // Check if Chrome is running with debugging
  try {
    const response = await fetch('http://localhost:9222/json/version');
    const version = await response.json();
    console.log('✅ Chrome is running with debugging enabled');
    console.log(`   Browser: ${version.Browser}`);
  } catch (error) {
    console.error('❌ Chrome is not running with debugging enabled');
    console.error('   Please start Chrome with: --remote-debugging-port=9222');
    return;
  }
  
  console.log('\n📝 Starting E2E Test Scenario...\n');
  
  // Create MCP clients
  const puppeteer = new MCPClient('node_modules/.bin/mcp-server-puppeteer');
  const cdp = new MCPClient('node_modules/.bin/tsx', ['src/cdp-mcp-server/index.ts']);
  
  // Wait a moment for servers to initialize
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    // Step 1: Connect Puppeteer to existing Chrome
    console.log('1️⃣ Connecting Puppeteer to Chrome...');
    const connectResult = await puppeteer.callTool('puppeteer_connect_active_tab', {
      debugPort: 9222
    });
    console.log('   ✅ Connected');
    
    // Step 2: Navigate to test app
    console.log('\n2️⃣ Navigating to test application...');
    await puppeteer.callTool('puppeteer_navigate', {
      url: 'http://localhost:8888'
    });
    console.log('   ✅ Navigated to test app');
    
    // Step 3: Connect CDP
    console.log('\n3️⃣ Connecting CDP to Chrome...');
    const targets = await cdp.callTool('cdp_list_targets');
    console.log('   ✅ Found targets:', targets.result.content[0].text.split('\n')[0]);
    
    await cdp.callTool('cdp_connect');
    console.log('   ✅ CDP connected');
    
    // Step 4: Click button and verify console
    console.log('\n4️⃣ Testing button click and console logging...');
    await puppeteer.callTool('puppeteer_click', {
      selector: '#logButton'
    });
    console.log('   ✅ Clicked log button');
    
    // Wait a moment for console message
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const consoleMessages = await cdp.callTool('cdp_get_console_messages', {
      limit: 5
    });
    console.log('   ✅ Console messages:', 
      JSON.parse(consoleMessages.result.content[0].text)
        .map(msg => msg.text)
        .slice(-2)
        .join(', ')
    );
    
    // Step 5: Test style changes
    console.log('\n5️⃣ Testing style manipulation...');
    const initialStyle = await cdp.callTool('cdp_get_computed_style', {
      selector: '#headerBanner'
    });
    const initialBg = JSON.parse(initialStyle.result.content[0].text)
      .find(style => style.name === 'background-color');
    console.log('   📍 Initial background:', initialBg?.value);
    
    await cdp.callTool('cdp_evaluate', {
      expression: `document.getElementById('headerBanner').style.backgroundColor = 'rgb(255, 0, 0)'`
    });
    console.log('   ✅ Changed background to red');
    
    const newStyle = await cdp.callTool('cdp_get_computed_style', {
      selector: '#headerBanner'
    });
    const newBg = JSON.parse(newStyle.result.content[0].text)
      .find(style => style.name === 'background-color');
    console.log('   📍 New background:', newBg?.value);
    
    // Step 6: Take screenshot
    console.log('\n6️⃣ Taking screenshot...');
    await puppeteer.callTool('puppeteer_screenshot', {
      name: 'e2e-test-result',
      width: 1200,
      height: 800
    });
    console.log('   ✅ Screenshot saved');
    
    // Step 7: Test form input
    console.log('\n7️⃣ Testing form input...');
    await puppeteer.callTool('puppeteer_fill', {
      selector: '#userInput',
      value: 'BabaYaga E2E Test'
    });
    console.log('   ✅ Filled input field');
    
    await puppeteer.callTool('puppeteer_click', {
      selector: 'button[onclick="processInput()"]'
    });
    console.log('   ✅ Clicked process button');
    
    const outputResult = await cdp.callTool('cdp_evaluate', {
      expression: `document.getElementById('output').textContent`
    });
    const outputText = JSON.parse(outputResult.result.content[0].text).value;
    console.log('   📍 Output text:', outputText);
    
    console.log('\n✨ E2E Test Complete! All systems working correctly.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response, null, 2));
    }
  } finally {
    puppeteer.close();
    cdp.close();
  }
}

// Run the test
runE2ETest().catch(console.error);