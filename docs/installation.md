# BabaYaga Installation Guide

This guide covers installation and configuration of BabaYaga, the unified browser automation framework for Claude Desktop.

## Prerequisites

- Node.js v18.0.0 or higher
- npm (comes with Node.js)
- Chrome or Chromium browser (automatically installed by Puppeteer)
- Claude Desktop

## Quick Installation

### Step 1: Clone and Install

```bash
git clone https://github.com/banditburai/babayaga.git
cd babayaga
npm install
npm run build
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
      "command": "node",
      "args": ["build/index.js"],
      "cwd": "/absolute/path/to/babayaga"
    }
  }
}
```

## Configuration Options

You can customize BabaYaga's behavior using environment variables in the Claude config:

```json
{
  "mcpServers": {
    "babayaga": {
      "command": "node",
      "args": ["build/index.js"],
      "cwd": "/absolute/path/to/babayaga",
      "env": {
        "HEADLESS": "true",
        "START_URL": "https://example.com",
        "SCREENSHOT_PATH": "/path/to/screenshots"
      }
    }
  }
}
```

### Available Environment Variables

- `HEADLESS` - Run browser in headless mode (`true`/`false`, default: `false`)
- `START_URL` - Initial URL to navigate to (default: `https://wikipedia.org`)
- `SCREENSHOT_PATH` - Directory for saving screenshots (default: `./screenshots`)
- `BROWSER_ARGS` - Additional Chrome arguments, comma-separated

## Using as NPM Dependency

If you want to use BabaYaga in your own project:

```bash
npm install github:banditburai/babayaga
```

Then in your Claude config:

```json
{
  "mcpServers": {
    "babayaga": {
      "command": "node",
      "args": ["node_modules/babayaga/build/index.js"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

## Development Mode

For development, you can run without building:

```json
{
  "mcpServers": {
    "babayaga": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/absolute/path/to/babayaga"
    }
  }
}
```

## Verifying Installation

1. Restart Claude Desktop after updating the configuration
2. In Claude, you should see BabaYaga's tools available
3. Try a simple command like "Take a screenshot of the current page"

## Troubleshooting

### BabaYaga not showing up in Claude

1. Check the config file syntax (must be valid JSON)
2. Ensure the path to BabaYaga is absolute, not relative
3. Check Claude's logs for error messages

### Browser doesn't launch

1. Make sure Chrome/Chromium is accessible
2. Try setting `HEADLESS=true` to run without UI
3. Check if port 9222 is already in use

### Permission errors

1. Ensure BabaYaga has permission to write to the screenshots directory
2. On macOS, you may need to grant screen recording permissions

## Next Steps

- See [tools-reference.md](tools-reference.md) for available tools
- Check [architecture-diagram.md](architecture-diagram.md) to understand how it works
- Read [screenshot-workflow.md](screenshot-workflow.md) for screenshot examples