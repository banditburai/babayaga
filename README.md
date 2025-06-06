# 🔮 BabaYaga

> Unified browser automation framework with MCP (Model Context Protocol) integration

[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-purple)](https://github.com/modelcontextprotocol)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)

## What is BabaYaga?

BabaYaga is a streamlined browser automation MCP server that provides AI agents with direct Puppeteer control. Built with a unified architecture, it eliminates the complexity of multi-process coordination while offering smart features like automatic screenshot handling for MCP token limits.

### ✨ Key Features

- 🎯 **Single Process Architecture** - Everything runs in one Node.js process
- 🖼️ **Smart Screenshot Tool** - Automatically handles MCP token limits
- 🛠️ **Modular Tool System** - Organized by capability (browser, visual, performance)
- 📝 **Full TypeScript** - Type-safe implementation throughout
- 🚀 **Direct Puppeteer Control** - No proxy layers or IPC complexity
- 🔧 **Extensible** - Easy to add custom tools

## Installation

### 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/banditburai/babayaga.git
cd babayaga

# Install dependencies
npm install

# Build TypeScript
npm run build

# Start the MCP server
npm start
```

### 🤖 Claude Desktop Integration

Add BabaYaga to your Claude desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "babayaga": {
      "command": "node",
      "args": ["/path/to/babayaga/dist/index.js"],
      "env": {
        "START_URL": "https://example.com"
      }
    }
  }
}
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
- `screenshot` - Smart screenshot tool that automatically handles MCP token limits
  - Auto mode: Returns base64 for small images, saves to disk for large ones
  - `output: "file"` - Always save to disk
  - `output: "base64"` - Always return base64 (may hit token limits)
- `highlight` - Highlight elements
- `get_element_info` - Get element details

## Configuration

Environment variables:
- `HEADLESS` - Run browser in headless mode
- `SCREENSHOT_PATH` - Directory for screenshots (default: `./screenshots`)
- `BROWSER_ARGS` - Comma-separated browser arguments
- `START_URL` - URL to navigate to on startup (default: `https://wikipedia.org`)

## Development

```bash
npm run dev       # Watch mode
npm run build     # Build TypeScript
npm run lint      # Run linter
npm run typecheck # Type checking
```

## Usage Examples

### As MCP Server

The primary use case is as an MCP server for Claude:

```bash
npm start
```

### As a Library

```typescript
import { UnifiedBabaYaga } from 'babayaga';

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

## Architecture

BabaYaga uses a unified architecture that consolidates all functionality into a single MCP server:

- **Single Process**: No subprocess management or IPC complexity
- **Direct Control**: Puppeteer runs in the same process as the MCP server
- **Modular Tools**: Tools are organized by capability and easy to extend
- **Smart Features**: Automatic handling of MCP limitations (like token limits)

See [docs/unified-architecture-design.md](docs/unified-architecture-design.md) for detailed architecture documentation.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

MIT - See [LICENSE](LICENSE) for details.