# Babayaga - Browser Testing & QA Tools

A comprehensive suite of browser testing and quality assurance tools using Chrome DevTools Protocol (CDP) and Playwright, integrated with Claude Code via Model Context Protocol (MCP).

## Features

### Playwright MCP Server
- **Browser Automation**: Navigate, click, type, screenshot
- **Cross-browser Support**: Chrome, Firefox, Safari
- **Rich Selectors**: CSS, text, role-based element selection
- **Screenshot & PDF Generation**: Visual testing capabilities
- **Console & Network Monitoring**: Debug and performance testing

### Babayaga QA Server (CDP-based)
- **Element Measurement**: Precise dimension and positioning analysis
- **Layout Analysis**: Grid alignment and spacing consistency
- **Distance Calculation**: Spatial relationships between elements
- **Health Monitoring**: CDP connection and target management
- **Binary Data Handling**: Automatic screenshot and file processing

## Quick Setup

### 1. Clone and Install Dependencies

```bash
# Install Playwright MCP dependencies
cd playwright-mcp
npm install
npm run build

# Install Babayaga QA dependencies  
cd ../babayaga-qe
npm install
npm run build
```

### 2. Configure MCP Servers

**IMPORTANT**: Use the `.mcp.json` approach to avoid connection errors.

Copy the example configuration:
```bash
cp .mcp.json.example .mcp.json
```

Update the paths in `.mcp.json` to match your system:
```json
{
  "mcpServers": {
    "playwright-mcp": {
      "command": "/opt/homebrew/bin/node",
      "args": [
        "/absolute/path/to/babayaga/playwright-mcp/lib/browserServer.js"
      ]
    },
    "babayaga-qe": {
      "command": "/opt/homebrew/bin/tsx",
      "args": [
        "src/index.ts"
      ],
      "directory": "/absolute/path/to/babayaga/babayaga-qe"
    }
  }
}
```

### 3. Start Claude Code

When you start Claude Code in this directory, it will:
1. Auto-detect the `.mcp.json` configuration
2. Prompt you to approve the MCP servers
3. Automatically start the servers with proper paths

## Configuration Notes

### Why Use `.mcp.json`?

The project-local `.mcp.json` configuration approach is **strongly recommended** because:

- ✅ **Avoids MCP Error -32000**: The manual `claude mcp add` approach often causes "Connection closed" errors
- ✅ **Auto-detection**: Claude Code automatically finds and configures servers
- ✅ **Full Paths**: Resolves PATH issues that cause `npx` and relative path failures
- ✅ **Project Isolation**: Each project has its own MCP server configuration

### Manual Configuration (NOT Recommended)

If you must use manual configuration, ensure you use full paths:
```bash
# This often fails with -32000 errors:
claude mcp add playwright "npx playwright-mcp"

# This works better but still less reliable:
claude mcp add-json playwright '{"command": "/opt/homebrew/bin/node", "args": ["lib/browserServer.js"], "directory": "/full/path/to/playwright-mcp"}'
```

## Browser Setup

### For Playwright
No additional setup required - Playwright manages browsers automatically.

### For Babayaga QA (CDP)
Start Chrome with debugging enabled:
```bash
google-chrome --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1
```

## Available Tools

### Playwright Tools
- `browser_navigate` - Navigate to URLs
- `browser_screenshot` - Take screenshots
- `browser_click` - Click elements
- `browser_type` - Type text into fields
- `browser_select_option` - Select dropdown options
- `browser_console_messages` - Get console output
- `browser_network_requests` - Monitor network traffic
- And many more...

### Babayaga QA Tools
- `cdp_send_command` - Send raw CDP commands
- `cdp_list_targets` - List browser targets
- `cdp_connect_target` - Connect to specific targets
- `cdp_health_check` - Monitor connection health
- `qa_measure_element` - Measure element dimensions
- `qa_measure_distances` - Calculate element distances
- `qa_analyze_layout_grid` - Analyze layout consistency

## Troubleshooting

### MCP Connection Errors

If you see `MCP error -32000: Connection closed`:

1. **Check your configuration**: Ensure you're using `.mcp.json` with full paths
2. **Restart Claude Code**: Exit and restart to reload configuration
3. **Check file permissions**: Ensure executables are accessible
4. **Verify paths**: Use `which node` and `which tsx` to find correct paths

### Node.js Path Issues

Find your Node.js path:
```bash
which node      # Usually /opt/homebrew/bin/node or /usr/local/bin/node
which tsx       # Usually /opt/homebrew/bin/tsx
```

Update `.mcp.json` with the correct paths for your system.

### Browser Connection Issues

For CDP-based tools (Babayaga QA):
1. Ensure Chrome is running with `--remote-debugging-port=9222`
2. Test connection: `curl http://localhost:9222/json`
3. Check firewall settings if using remote debugging

## Development

### Adding New Tools

1. **Playwright**: Extend `playwright-mcp/src/tools/`
2. **Babayaga**: Extend `babayaga-qe/src/measurements/`

### Testing

```bash
# Test Playwright MCP
cd playwright-mcp && npm test

# Test Babayaga QA
cd babayaga-qe && npm run typecheck
```

## License

- **Playwright MCP**: Apache 2.0 (Microsoft)
- **Babayaga QA**: MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Test your changes with `.mcp.json` configuration
4. Submit a pull request