# 🔮 BabaYaga

> Unified browser automation coordinator for Claude - combining Puppeteer and Chrome DevTools Protocol through a single MCP interface

[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-purple)](https://github.com/modelcontextprotocol)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)

## What is BabaYaga?

BabaYaga is a powerful MCP server that coordinates browser automation tools, providing AI agents with unified access to both Puppeteer and Chrome DevTools Protocol capabilities. It acts as an intelligent orchestrator, offering composite tools, response transformations, and advanced features like tool chaining and connection pooling.

### ✨ Key Features

- 🎯 **Unified Interface** - Single MCP server coordinating multiple browser automation services
- 🔗 **Tool Chaining** - Execute complex multi-step workflows with conditional logic
- 🔄 **Response Transformations** - Automatic formatting and standardization of tool outputs
- 🚀 **Connection Pooling** - High-performance CDP connection management
- 🛠️ **Composite Tools** - Pre-built workflows combining Puppeteer and CDP capabilities
- 📊 **Visual Regression** - Built-in screenshot comparison and performance metrics
- 🌊 **Streaming Support** - Handle large responses efficiently
- 🔧 **Flexible Architecture** - Run services independently or let BabaYaga manage them

## Installation

### 🚀 Quick Setup

```bash
# Clone BabaYaga
git clone https://github.com/banditburai/babayaga.git
cd babayaga

# Install dependencies
npm install

# Run interactive setup
npm run setup
```

### 🤖 Claude Integration

Add BabaYaga to your Claude desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "babayaga": {
      "command": "npm",
      "args": ["run", "start:babayaga"],
      "cwd": "/path/to/babayaga"
    }
  }
}
```

## Usage

### Starting BabaYaga

```bash
# Option 1: Let BabaYaga handle everything (recommended)
npm run start:babayaga
# BabaYaga will automatically start Chrome if needed

# Option 2: Start Chrome manually first
npm run chrome
# Then in another terminal:
npm run start:babayaga

# Option 3: Disable auto-start
BABAYAGA_AUTO_START_CHROME=false npm run start:babayaga
```

BabaYaga automatically:
- Checks if Chrome is running with debugging enabled
- Starts Chrome if needed (unless disabled)
- Manages Puppeteer and CDP services

### Available Tools

#### 🎭 Puppeteer Tools (via BabaYaga)
| Tool | Description |
|------|-------------|
| `puppeteer_connect` | Connect to Chrome instance |
| `puppeteer_navigate` | Navigate to URLs |
| `puppeteer_screenshot` | Capture screenshots |
| `puppeteer_click` | Click elements |
| `puppeteer_fill` | Fill form inputs |
| `puppeteer_select` | Select dropdown options |
| `puppeteer_hover` | Hover over elements |
| `puppeteer_evaluate` | Execute JavaScript |

#### 🔍 CDP Tools (via BabaYaga)
| Tool | Description |
|------|-------------|
| `cdp_command` | Execute any Chrome DevTools Protocol command |

#### 🎯 Composite Tools
| Tool | Description |
|------|-------------|
| `visual-regression` | Compare screenshots with baselines |
| `web_performance_test` | Comprehensive performance analysis |
| `chain_full_page_analysis` | Complete page analysis workflow |
| `chain_interactive_test_flow` | Test interactive elements |

### Example Usage in Claude

```
# Basic navigation and screenshot
Use babayaga to navigate to https://example.com
Use babayaga to take a screenshot named "homepage"

# Performance testing
Use babayaga's web_performance_test tool with url "https://example.com" and metrics ["performance", "console", "network"]

# Visual regression testing
Use babayaga's visual-regression tool to compare https://example.com with baseline "prod-homepage"

# Execute CDP commands
Use babayaga's cdp_command tool with method "Performance.getMetrics"

# Run a full page analysis chain
Use babayaga's chain_full_page_analysis tool with url "https://example.com"
```

## Architecture

BabaYaga uses a modern service-oriented architecture:

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Claude    │────▶│   BabaYaga   │────▶│ Puppeteer MCP   │
└─────────────┘     │ (Coordinator)│     └─────────────────┘
                    │              │
                    │  • Registry  │     ┌─────────────────┐
                    │  • Transform │────▶│    CDP MCP      │
                    │  • Chaining  │     └─────────────────┘
                    │  • Pooling   │
                    └──────────────┘
```

### Advanced Configuration

Create a `babayaga.config.json` for custom setups:

```json
{
  "services": [
    {
      "name": "cdp",
      "url": "ws://localhost:3001",
      "useConnectionPool": true,
      "poolConfig": {
        "minConnections": 2,
        "maxConnections": 10
      }
    }
  ]
}
```

## Advanced Features

### Tool Chaining

Execute complex workflows with conditional logic:

```javascript
// Example chain definition
{
  "name": "full_page_analysis",
  "steps": [
    { "service": "puppeteer", "tool": "navigate", "params": { "url": "${url}" } },
    { "service": "puppeteer", "tool": "screenshot", "outputKey": "screenshot" },
    { "service": "cdp", "tool": "cdp_command", "params": { "method": "Performance.getMetrics" }, "outputKey": "metrics" }
  ]
}
```

### Response Transformations

BabaYaga automatically transforms responses for better readability:
- CDP metrics are grouped by category
- Binary outputs are saved to files with metadata
- Console messages are formatted with timestamps
- Large responses are streamed or saved to disk

### Connection Pooling

For high-performance scenarios, enable connection pooling for CDP:
- Maintains multiple persistent connections
- Automatic health checks and reconnection
- Configurable pool size and timeouts

## Testing

```bash
# Type checking
npx tsc --noEmit

# Test server connectivity
npm run test:servers

# Run E2E tests
npm run test:e2e
```

## Project Structure

```
babayaga/
├── src/
│   ├── babayaga-server/      # Main coordinator server
│   │   ├── index.ts          # Server entry point
│   │   └── tools/            # Tool infrastructure
│   │       ├── registry.ts   # Tool registry
│   │       ├── builtin/      # Built-in tools
│   │       ├── composite/    # Composite tools
│   │       ├── transformers/ # Response transformers
│   │       ├── chaining.ts   # Tool chain executor
│   │       └── streaming.ts  # Streaming support
│   ├── types/                # TypeScript definitions
│   └── utils/                # Utilities
│       ├── service-discovery.ts
│       └── connection-pool.ts
├── scripts/                  # Setup and utility scripts
├── docs/                     # Documentation
└── PLAN.md                   # Implementation plan
```

## Documentation

- 📚 [Installation Guide](docs/installation.md) - Detailed setup instructions
- 🤖 [Tools Reference](docs/tools-reference.md) - Complete tool documentation
- 🏗️ [Architecture Overview](docs/architecture-diagram.md) - System design details
- 🧪 [Testing Guide](TESTING.md) - Testing procedures

## Troubleshooting

### Chrome Connection Issues
- Ensure Chrome is running with `--remote-debugging-port=9222`
- Check that no other process is using port 9222
- Try `npm run chrome` to start Chrome correctly

### Service Connection Failures
- Check the console output for specific error messages
- Verify all dependencies are installed with `npm install`
- For manual service startup, see the configuration examples

### Tool Not Found
- Ensure BabaYaga has successfully connected to all services
- Check that the tool name includes the service prefix (e.g., `puppeteer_screenshot`)
- Review available tools in the startup console output

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ❤️ for the MCP ecosystem
</p>