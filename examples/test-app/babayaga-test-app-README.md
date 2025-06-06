# BabaYaga Test App - Unified Branch Setup

This updates your babayaga-test-app to use the new unified architecture.

## Quick Start

1. Copy the new `package.json` to your babayaga-test-app directory:
   ```bash
   cp babayaga-test-app-package.json /path/to/babayaga-test-app/package.json
   ```

2. Copy the update script:
   ```bash
   cp update-unified.sh /path/to/babayaga-test-app/
   chmod +x /path/to/babayaga-test-app/update-unified.sh
   ```

3. In your babayaga-test-app directory, choose one approach:

   **Option A: NPM Dependency (Recommended)**
   ```bash
   npm install
   npm start
   ```

   **Option B: Local Clone**
   ```bash
   ./update-unified.sh
   npm run start:local
   ```

## What Changed?

The old setup used:
- Multiple MCP servers (puppeteer-mcp, devtools-mcp, babayaga-server)
- Express server for test app
- Complex orchestration with multiple processes

The unified setup uses:
- Single MCP server with all tools
- Direct Puppeteer integration
- No Express needed (opens Wikipedia by default)
- Simple, single-process architecture

## Available Scripts

- `npm start` - Start BabaYaga (from node_modules)
- `npm run start:local` - Start BabaYaga (from local clone)
- `npm run update-unified` - Update to latest unified version
- `npm run clean` - Clean everything and start fresh

## Customizing Start URL

```bash
# Default (Wikipedia)
npm start

# Custom URL (when using local clone)
cd babayaga-unified
START_URL=https://github.com npm start
```