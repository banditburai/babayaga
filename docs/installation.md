# BabaYaga Installation Guide

This guide covers installation and configuration of BabaYaga, the unified browser automation coordinator for Claude.

## Prerequisites

- Node.js v18.0.0 or higher
- npm (comes with Node.js)
- Chrome or Chromium browser
- Claude Desktop

## Quick Installation

### Step 1: Clone and Install

```bash
git clone https://github.com/banditburai/babayaga.git
cd babayaga
npm install
```

### Step 2: Configure Claude Desktop

Add BabaYaga to your Claude desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "babayaga": {
      "command": "npm",
      "args": ["run", "start:babayaga"],
      "cwd": "/absolute/path/to/babayaga"
    }
  }
}
```

**Important**: Use the absolute path to your BabaYaga directory.

### Step 3: Restart Claude

Restart Claude Desktop to load the new configuration.

## How BabaYaga Works

BabaYaga is a single MCP server that:
1. Automatically starts Chrome with debugging enabled (if not running)
2. Manages Puppeteer and CDP services as child processes
3. Provides a unified interface for all browser automation tools
4. Handles response transformations and tool coordination

You only need to configure one MCP server (BabaYaga) in Claude!

## Advanced Configuration

### Custom Service Configuration

Create a `babayaga.config.json` file for custom setups:

```json
{
  "services": [
    {
      "name": "puppeteer",
      "command": "npm",
      "args": ["run", "start:puppeteer-mcp"],
      "healthCheckInterval": 30000
    },
    {
      "name": "cdp",
      "command": "npm", 
      "args": ["run", "start:cdp-mcp"],
      "healthCheckInterval": 30000
    }
  ]
}
```

### Running Services Independently

For debugging or advanced setups, you can run services separately:

```bash
# Terminal 1: Puppeteer MCP
npm run start:puppeteer-mcp

# Terminal 2: CDP MCP  
npm run start:cdp-mcp

# Terminal 3: BabaYaga (with config pointing to services)
BABAYAGA_CONFIG=./babayaga.config.json npm run start:babayaga
```

### Connection Pooling

For high-performance scenarios, enable connection pooling:

```json
{
  "services": [
    {
      "name": "cdp",
      "url": "ws://localhost:3001",
      "useConnectionPool": true,
      "poolConfig": {
        "minConnections": 2,
        "maxConnections": 10,
        "idleTimeout": 300000,
        "acquireTimeout": 5000
      }
    }
  ]
}
```

## Environment Variables

Customize BabaYaga behavior:

```bash
# Disable automatic Chrome startup
BABAYAGA_AUTO_START_CHROME=false npm run start:babayaga

# Custom Chrome debugging port
CHROME_DEBUG_PORT=9223 npm run start:babayaga

# Custom configuration file
BABAYAGA_CONFIG=./my-config.json npm run start:babayaga

# Chrome executable path
CHROME_PATH="/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary" npm run start:babayaga
```

## Verifying Installation

### Test Server Connectivity

```bash
npm run test:servers
```

### Run E2E Tests

```bash
npm run test:e2e
```

### Test in Claude

Ask Claude:
```
Use babayaga to navigate to https://example.com and take a screenshot
```

## Troubleshooting

### Chrome Connection Issues

If BabaYaga can't connect to Chrome:

1. **Check Chrome is running:**
   ```bash
   ps aux | grep chrome
   ```

2. **Verify the debugging port:**
   ```bash
   curl http://localhost:9222/json/version
   ```

3. **Check for port conflicts:**
   ```bash
   lsof -i :9222
   ```

4. **Use a different port:**
   ```bash
   CHROME_DEBUG_PORT=9223 npm run chrome
   ```

### Service Startup Issues

If services fail to start:

1. **Check the logs** - BabaYaga provides detailed console output
2. **Verify dependencies:**
   ```bash
   npm install
   ```
3. **Check Node version:**
   ```bash
   node --version  # Should be >= 18.0.0
   ```

### Tool Not Found

If Claude can't find BabaYaga tools:

1. **Check MCP configuration** - Ensure the path in `claude_desktop_config.json` is absolute
2. **Restart Claude** - Configuration changes require a restart
3. **Check service status** - Look for "Available tools:" in BabaYaga's startup output

## Updating BabaYaga

```bash
cd babayaga
git pull origin main
npm install
```

## Uninstalling

1. Remove from Claude configuration:
   - Edit `claude_desktop_config.json`
   - Remove the "babayaga" entry from "mcpServers"

2. Delete the directory:
   ```bash
   rm -rf /path/to/babayaga
   ```

## Project Setups

### For Teams

Add BabaYaga as a git submodule:

```bash
# In your project root
git submodule add https://github.com/banditburai/babayaga.git
cd babayaga && npm install && cd ..

# Create project config
cat > claude-config.json << 'EOF'
{
  "mcpServers": {
    "babayaga": {
      "command": "npm",
      "args": ["run", "start:babayaga"],
      "cwd": "./babayaga"
    }
  }
}
EOF
```

Team members can then:
```bash
git clone --recurse-submodules <your-repo>
# Add babayaga path from claude-config.json to their Claude config
```

### For CI/CD

BabaYaga can be used in automated environments:

```bash
# Start Chrome in headless mode
chrome --headless --remote-debugging-port=9222

# Start BabaYaga programmatically
cd babayaga && npm run start:babayaga
```

## Next Steps

- Read the [Tools Reference](tools-reference.md) to learn about available tools
- Check out the [Architecture Overview](architecture-diagram.md) to understand how BabaYaga works
- See [Testing Guide](../TESTING.md) for testing examples