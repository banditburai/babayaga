# BabaYaga Testing Guide

## Prerequisites

- Node.js v18.0.0 or higher
- Chrome or Chromium browser
- All dependencies installed (`npm install`)

## Quick Test Suite

```bash
# 1. Test MCP server connectivity
npm run test:servers

# 2. Start Chrome with debugging
npm run chrome

# 3. Run full E2E test (in another terminal)
npm run test:e2e
```

## What Gets Tested

### 1. MCP Server Health Check (`npm run test:servers`)
Tests that both MCP servers start correctly and respond to `tools/list` requests:
- ✅ Puppeteer MCP server provides 8 tools
- ✅ CDP MCP server provides 5 tools
- ✅ Proper JSON-RPC communication

### 2. E2E Test Suite (`npm run test:e2e`)
Automated test that verifies:
- Chrome connection with debugging port
- Navigation to test application
- Button clicks and console message capture
- Style manipulation via CDP
- Screenshot capabilities
- Form input processing

### 3. TypeScript Compilation
```bash
npx tsc --noEmit
```
Verifies all TypeScript code compiles without errors.

## Manual Testing Checklist

### For Team Setup
1. Create a new test project
2. Add BabaYaga as submodule
3. Run `npm run setup` and choose "Team Setup"
4. Verify `.mcp.json` is created
5. Test that team members can use the tools after cloning

### For Individual Setup
1. Clone BabaYaga to `~/tools/`
2. Run `npm run setup` and choose "Individual Setup"
3. Verify commands are displayed correctly
4. Run the claude mcp add commands
5. Verify with `claude mcp list -s user`

## Available Test Commands

| Command | Description |
|---------|-------------|
| `npm run test:servers` | Tests MCP server connectivity |
| `npm run test:e2e` | Runs full E2E browser automation test |
| `npm run chrome` | Starts Chrome with debugging enabled |
| `npx tsc --noEmit` | Type-checks all TypeScript files |

## Test Application Features

The test app (`http://localhost:8888`) includes:
- **Console Logging Buttons**: Test message capture
- **Style Manipulation**: Test DOM modification
- **Form Input**: Test user interaction
- **Live Console Display**: Visual feedback

## Troubleshooting Test Failures

### test:servers fails
- Check Node.js version (must be 18+)
- Ensure `npm install` completed successfully
- Look for port conflicts

### test:e2e fails
- Ensure Chrome is running with `npm run chrome`
- Check Chrome is accessible on port 9222
- Verify test app is running on port 8888

### Chrome won't start
- Check if port 9222 is already in use: `lsof -i :9222`
- Try different port: `CHROME_DEBUG_PORT=9223 npm run chrome`
- Ensure Chrome/Chromium is installed

## Platform-Specific Notes

### macOS
- Chrome location: `/Applications/Google Chrome.app`
- Alternative: Chrome Canary, Chromium

### Windows
- Chrome location: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- Run terminals as Administrator if needed

### Linux
- Chrome packages: `google-chrome`, `chromium-browser`
- May need: `--disable-gpu` flag

## Contributing Tests

When adding new features:
1. Add test cases to `test:e2e` script
2. Update this testing guide
3. Ensure all tests pass before PR