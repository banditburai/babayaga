# BabaYaga Unified

A simplified, unified browser automation framework with MCP (Model Context Protocol) integration.

## Architecture

This is a complete rewrite of BabaYaga that consolidates multiple MCP servers into a single, unified server. Key improvements:

- **Single Process**: Everything runs in one Node.js process
- **Direct Control**: No subprocess management or IPC complexity  
- **Modular Tools**: Organized by capability (browser, visual, performance)
- **Type Safety**: Full TypeScript implementation
- **MCP Best Practices**: Following official architecture guidelines

## Installation

```bash
npm install
npm run build
```

## Usage

### As MCP Server

```bash
npm start
```

This starts the MCP server on stdio, ready to be used by Claude or other MCP clients.

### As Library

```typescript
import { UnifiedBabaYaga } from 'babayaga-unified';

const babayaga = new UnifiedBabaYaga({
  headless: false,
  screenshotPath: './screenshots'
});

// Register custom tool
babayaga.registerTool({
  name: 'my_tool',
  description: 'Custom tool',
  inputSchema: { type: 'object', properties: {} },
  handler: async (args, { page }) => {
    // Tool implementation
    return { success: true };
  }
});

await babayaga.start();
```

## Available Tools

### Browser Control
- `navigate` - Navigate to URLs
- `click` - Click elements
- `type` - Type text
- `wait` - Wait for conditions
- `evaluate` - Execute JavaScript
- `page_info` - Get page information
- `go_back` / `go_forward` - History navigation
- `reload` - Reload page

### Visual Tools
- `screenshot` - Capture screenshots (base64/binary)
- `save_screenshot` - Save screenshots to disk
- `highlight` - Highlight elements
- `get_element_info` - Get element details

## Configuration

Environment variables:
- `HEADLESS` - Run browser in headless mode
- `SCREENSHOT_PATH` - Directory for screenshots
- `BROWSER_ARGS` - Comma-separated browser arguments
- `START_URL` - URL to navigate to on startup (defaults to https://wikipedia.org)

## Development

```bash
npm run dev    # Watch mode
npm run build  # Build TypeScript
npm run lint   # Run linter
npm run typecheck  # Type checking
```

## Architecture Details

See [unified-architecture-design.md](../docs/unified-architecture-design.md) for complete architecture documentation.