#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve, relative, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const babayagaRoot = resolve(__dirname, '..');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

console.log('🔮 BabaYaga Setup Wizard\n');

async function main() {
  // Detect if we're being run from within a project or standalone
  const isStandalone = process.cwd() === babayagaRoot;
  
  console.log('How would you like to install BabaYaga?\n');
  console.log('1. Team Setup (Project-scoped via .mcp.json)');
  console.log('2. Individual Setup (User-scoped, available across all projects)');
  console.log('3. Both (Configure for team sharing AND personal use)\n');
  
  const choice = await question('Enter your choice (1-3): ');
  
  switch (choice.trim()) {
    case '1':
      await setupProjectScope();
      break;
    case '2':
      await setupUserScope();
      break;
    case '3':
      await setupProjectScope();
      await setupUserScope();
      break;
    default:
      console.log('Invalid choice. Exiting.');
      process.exit(1);
  }
  
  rl.close();
}

async function setupProjectScope() {
  console.log('\n📁 Setting up project-scoped MCP configuration...\n');
  
  if (process.cwd() === babayagaRoot) {
    console.log('⚠️  You are running setup from within BabaYaga itself.');
    console.log('For team setup, you should run this from your project directory.\n');
    
    const proceed = await question('Generate .mcp.json.example here? (y/n): ');
    if (proceed.toLowerCase() !== 'y') {
      return;
    }
  }
  
  // Determine relative path to BabaYaga
  let babayagaPath;
  if (process.cwd() === babayagaRoot) {
    babayagaPath = '.';
  } else {
    // Check if BabaYaga is a subdirectory
    const localBabayaga = join(process.cwd(), 'babayaga');
    if (existsSync(localBabayaga)) {
      babayagaPath = './babayaga';
    } else {
      console.log('\n⚠️  BabaYaga not found as a subdirectory.');
      console.log('Options:');
      console.log('1. Add as git submodule: git submodule add https://github.com/banditburai/babayaga.git');
      console.log('2. Clone directly: git clone https://github.com/banditburai/babayaga.git');
      console.log('3. Specify custom path\n');
      
      babayagaPath = await question('Enter path to BabaYaga (or press Enter to skip): ');
      if (!babayagaPath) {
        return;
      }
    }
  }
  
  // Create .mcp.json
  const mcpConfig = {
    mcpServers: {
      "puppeteer-babayaga": {
        "command": "npm",
        "args": ["run", "start:puppeteer-mcp"],
        "cwd": babayagaPath,
        "env": {}
      },
      "cdp-babayaga": {
        "command": "npm",
        "args": ["run", "start:cdp-mcp"],
        "cwd": babayagaPath,
        "env": {}
      }
    }
  };
  
  const mcpPath = join(process.cwd(), '.mcp.json');
  
  if (existsSync(mcpPath)) {
    const existing = JSON.parse(readFileSync(mcpPath, 'utf8'));
    if (existing.mcpServers?.['puppeteer-babayaga'] || existing.mcpServers?.['cdp-babayaga']) {
      const overwrite = await question('\n⚠️  BabaYaga servers already configured in .mcp.json. Overwrite? (y/n): ');
      if (overwrite.toLowerCase() !== 'y') {
        return;
      }
    }
    // Merge with existing
    existing.mcpServers = {
      ...existing.mcpServers,
      ...mcpConfig.mcpServers
    };
    writeFileSync(mcpPath, JSON.stringify(existing, null, 2));
  } else {
    writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2));
  }
  
  console.log('\n✅ Created/updated .mcp.json');
  console.log('\n📝 Next steps for team setup:');
  console.log('1. Ensure BabaYaga is installed: cd ' + babayagaPath + ' && npm install');
  console.log('2. Commit .mcp.json to your repository');
  console.log('3. Restart Claude Code in this project directory to load the servers');
  console.log('4. Team members will be prompted to approve servers on first use');
  console.log('\n⚠️  Note: .mcp.json support may require Claude Code restart');
  console.log('\n💡 To start Chrome: cd ' + babayagaPath + ' && npm run chrome');
}

async function setupUserScope() {
  console.log('\n👤 Setting up user-scoped MCP configuration...\n');
  
  // Ensure we're in BabaYaga directory or find it
  let babayagaDir;
  if (process.cwd() === babayagaRoot) {
    babayagaDir = babayagaRoot;
  } else {
    const localBabayaga = join(process.cwd(), 'babayaga');
    if (existsSync(localBabayaga)) {
      babayagaDir = resolve(localBabayaga);
    } else {
      console.log('Enter the full path to your BabaYaga installation:');
      const customPath = await question('Path: ');
      if (!existsSync(customPath)) {
        console.log('❌ Path does not exist');
        return;
      }
      babayagaDir = resolve(customPath);
    }
  }
  
  console.log('\n🔧 Installing dependencies...');
  try {
    execSync('npm install', { cwd: babayagaDir, stdio: 'inherit' });
  } catch (error) {
    console.log('⚠️  Failed to install dependencies. Please run npm install manually.');
  }
  
  console.log('\n📝 Run these commands to add BabaYaga to your user configuration:\n');
  console.log(`# First, navigate to the BabaYaga directory:`);
  console.log(`cd ${babayagaDir}\n`);
  
  console.log(`# Then add the MCP servers:`);
  console.log(`claude mcp add puppeteer-babayaga -s user \\`);
  console.log(`  "npm" "run" "start:puppeteer-mcp"\n`);
  
  console.log(`claude mcp add cdp-babayaga -s user \\`);
  console.log(`  "npm" "run" "start:cdp-mcp"\n`);
  
  console.log('💡 These servers will be available in ALL your Claude Code projects');
  console.log(`💡 To start Chrome: npm run chrome`);
  
  const runCommands = await question('\nWould you like to run these commands now? (y/n): ');
  if (runCommands.toLowerCase() === 'y') {
    try {
      console.log('\nAdding Puppeteer MCP server...');
      execSync(`claude mcp add puppeteer-babayaga -s user "npm" "run" "start:puppeteer-mcp"`, { 
        stdio: 'inherit',
        cwd: babayagaDir
      });
      
      console.log('\nAdding CDP MCP server...');
      execSync(`claude mcp add cdp-babayaga -s user "npm" "run" "start:cdp-mcp"`, { 
        stdio: 'inherit',
        cwd: babayagaDir
      });
      
      console.log('\n✅ Successfully added BabaYaga servers to user configuration!');
    } catch (error) {
      console.log('\n⚠️  Failed to run claude commands. Please run them manually.');
    }
  }
}

main().catch(console.error);