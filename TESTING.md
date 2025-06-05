# BabaYaga Testing Guide

## Prerequisites

- Node.js v18.0.0 or higher
- Chrome or Chromium browser
- All dependencies installed (`npm install`)

## Quick Test Suite

```bash
# 1. Start Chrome with debugging
npm run chrome

# 2. In a new terminal, start BabaYaga
npm run start:babayaga

# 3. In another terminal, run tests
npm run test:e2e
```

## What Gets Tested

### 1. Type Checking
```bash
npx tsc --noEmit
```
Verifies all TypeScript code compiles without errors.

### 2. E2E Test Suite (`npm run test:e2e`)
Comprehensive test that verifies:
- BabaYaga server starts correctly
- Chrome connection with debugging port
- Tool registration and discovery
- Navigation and screenshots via Puppeteer tools
- CDP command execution
- Composite tool functionality
- Response transformations
- Error handling

## Manual Testing in Claude

After configuring BabaYaga in Claude Desktop:

### Basic Tool Testing
```
# Test Puppeteer tools
Use babayaga's puppeteer_navigate tool to go to https://example.com
Use babayaga's puppeteer_screenshot tool to capture a screenshot named "test"

# Test CDP tools
Use babayaga's cdp_command tool with method "Runtime.evaluate" and params {"expression": "document.title"}
Use babayaga's cdp_command tool with method "Performance.getMetrics"
```

### Composite Tool Testing
```
# Visual regression
Use babayaga's visual-regression tool to test https://example.com with baseline "homepage"

# Performance testing
Use babayaga's web_performance_test tool with url "https://example.com" and metrics ["performance", "console"]

# Tool chains
Use babayaga's chain_full_page_analysis tool with url "https://example.com"
```

### Advanced Testing
```
# Test response transformations
Use babayaga's cdp_command tool with method "Page.captureScreenshot" 
(Should save to cdp-output/ and return file reference)

# Test error handling
Use babayaga's puppeteer_click tool with selector "#nonexistent"
(Should return graceful error)
```

## Testing Different Configurations

### 1. Default Configuration (Child Processes)
```bash
# Just start BabaYaga - it manages everything
npm run start:babayaga
```

### 2. Independent Services
```bash
# Terminal 1
npm run start:puppeteer-mcp

# Terminal 2  
npm run start:cdp-mcp

# Terminal 3 - with custom config
cat > test-config.json << 'EOF'
{
  "services": [
    {
      "name": "puppeteer",
      "url": "ws://localhost:3000"
    },
    {
      "name": "cdp",
      "url": "ws://localhost:3001"
    }
  ]
}
EOF

BABAYAGA_CONFIG=./test-config.json npm run start:babayaga
```

### 3. Connection Pooling Test
```bash
# Create pooled config
cat > pooled-config.json << 'EOF'
{
  "services": [
    {
      "name": "cdp",
      "command": "npm",
      "args": ["run", "start:cdp-mcp"],
      "useConnectionPool": true,
      "poolConfig": {
        "minConnections": 2,
        "maxConnections": 5
      }
    }
  ]
}
EOF

BABAYAGA_CONFIG=./pooled-config.json npm run start:babayaga
```

## Test Checklist

### Core Functionality
- [ ] BabaYaga starts without errors
- [ ] All tools are registered (check startup logs)
- [ ] Chrome connection works
- [ ] Basic Puppeteer tools work (navigate, screenshot)
- [ ] CDP commands execute successfully
- [ ] Visual regression tool creates baselines
- [ ] Composite tools complete workflows

### Advanced Features
- [ ] Response transformations format output correctly
- [ ] Large responses are saved to files
- [ ] Tool chains execute in sequence
- [ ] Connection pooling maintains multiple connections
- [ ] Health checks reconnect failed services
- [ ] Error handling provides useful feedback

### Performance
- [ ] Tools respond within reasonable time
- [ ] Memory usage stays stable
- [ ] Connection pool efficiently reuses connections
- [ ] Large responses don't block other operations

## Debugging Test Failures

### BabaYaga Won't Start
1. Check Node.js version: `node --version` (must be >= 18)
2. Verify installation: `npm install`
3. Check for port conflicts
4. Review console output for specific errors

### Chrome Connection Issues
1. Ensure Chrome is running: `npm run chrome`
2. Verify debug port: `curl http://localhost:9222/json/version`
3. Check firewall settings
4. Try different port: `CHROME_DEBUG_PORT=9223 npm run chrome`

### Tool Discovery Problems
1. Check service connection in startup logs
2. Verify tool prefixes (e.g., `puppeteer_`, `cdp_`)
3. Review service health check status
4. Try running services independently

### Response Transformation Issues
1. Check transformer registration
2. Verify response format matches transformer expectations
3. Review console logs for transformation errors
4. Test with raw tool calls first

## Platform-Specific Notes

### macOS
- Chrome location: `/Applications/Google Chrome.app`
- May need to allow Chrome in Security & Privacy settings

### Windows
- Chrome location: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- Run as Administrator if permission issues occur

### Linux
- Chrome packages: `google-chrome-stable`, `chromium`
- May need: `--no-sandbox` flag in some environments

## Contributing Tests

When adding new features:
1. Add corresponding test cases
2. Update this testing guide
3. Ensure all existing tests pass
4. Add integration tests for new tools
5. Document any new test commands

## Continuous Integration

For CI/CD environments:

```bash
# Headless Chrome
chrome --headless --remote-debugging-port=9222 &

# Wait for Chrome
sleep 5

# Run BabaYaga
npm run start:babayaga &

# Wait for services
sleep 10

# Run tests
npm run test:e2e
```