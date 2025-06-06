# BabaYaga Standalone App Example

This example demonstrates how to use BabaYaga as a dependency in your own project.

## Setup

```bash
# Install dependencies (this will also set up BabaYaga)
npm install

# Start BabaYaga MCP server
npm start
```

## Available Scripts

- `npm start` - Start BabaYaga from node_modules
- `npm run start:built` - Run pre-built version (faster startup)
- `npm run update` - Update to latest BabaYaga version

## Using with Claude Desktop

1. Update your Claude desktop config to point to this directory:

```json
{
  "mcpServers": {
    "babayaga": {
      "command": "npm",
      "args": ["start"],
      "cwd": "/path/to/this/example"
    }
  }
}
```

## Customizing

You can set environment variables to customize BabaYaga:

```bash
# Start with custom URL
START_URL=https://github.com npm start

# Run in headless mode
HEADLESS=true npm start
```

## Notes

- The `postinstall` script ensures BabaYaga's dependencies are installed
- This approach is best when you want to use BabaYaga without modifying its code
- For development on BabaYaga itself, clone the main repository instead