# BabaYaga Installation Guide

This guide covers all installation methods for BabaYaga, from quick setup to advanced configurations.

## Prerequisites

- Node.js v18.0.0 or higher
- npm (comes with Node.js)
- Chrome or Chromium browser
- Claude Code

## Installation Methods

### Method 1: Interactive Setup (Recommended)

The easiest way to get started:

```bash
git clone https://github.com/yourusername/babayaga.git
cd babayaga
npm install
npm run setup
```

The setup wizard will guide you through:
1. Choosing between team or individual setup
2. Configuring MCP servers
3. Generating necessary configuration files

### Method 2: Team Setup via Git Submodule

Perfect for projects where multiple developers need the same tools:

#### Step 1: Add BabaYaga as a submodule

```bash
# In your project root
git submodule add https://github.com/yourusername/babayaga.git
git commit -m "Add BabaYaga browser automation tools"
```

#### Step 2: Install dependencies

```bash
cd babayaga
npm install
cd ..
```

#### Step 3: Create .mcp.json

Create `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "puppeteer-babayaga": {
      "command": "npm",
      "args": ["run", "start:puppeteer-mcp"],
      "cwd": "./babayaga",
      "env": {}
    },
    "cdp-babayaga": {
      "command": "npm",
      "args": ["run", "start:cdp-mcp"],
      "cwd": "./babayaga",
      "env": {}
    }
  }
}
```

#### Step 4: Commit and share

```bash
git add .mcp.json
git commit -m "Configure BabaYaga MCP servers for team"
git push
```

#### For team members

When team members clone your repository:

```bash
git clone --recurse-submodules <your-repo-url>
# or if already cloned:
git submodule update --init --recursive

cd babayaga && npm install && cd ..
```

Claude Code will prompt them to approve the MCP servers on first use.

### Method 3: Individual User Setup

Install BabaYaga globally for personal use across all projects:

#### Step 1: Clone to a tools directory

```bash
mkdir -p ~/tools
cd ~/tools
git clone https://github.com/yourusername/babayaga.git
cd babayaga
npm install
```

#### Step 2: Register with Claude Code

```bash
# Register Puppeteer MCP server
claude mcp add puppeteer-babayaga -s user \
  "npm" "run" "start:puppeteer-mcp" \
  --cwd "$HOME/tools/babayaga"

# Register CDP MCP server
claude mcp add cdp-babayaga -s user \
  "npm" "run" "start:cdp-mcp" \
  --cwd "$HOME/tools/babayaga"
```

#### Step 3: Verify installation

```bash
claude mcp list -s user
```

You should see both `puppeteer-babayaga` and `cdp-babayaga` listed.

### Method 4: Direct Clone (For Testing)

If you just want to try BabaYaga:

```bash
# Clone anywhere
git clone https://github.com/yourusername/babayaga.git
cd babayaga
npm install

# Create .mcp.json in the babayaga directory
cat > .mcp.json << 'EOF'
{
  "mcpServers": {
    "puppeteer-babayaga": {
      "command": "npm",
      "args": ["run", "start:puppeteer-mcp"],
      "cwd": "."
    },
    "cdp-babayaga": {
      "command": "npm",
      "args": ["run", "start:cdp-mcp"],
      "cwd": "."
    }
  }
}
EOF
```

## Post-Installation

### Starting Chrome

BabaYaga requires Chrome to be running with remote debugging enabled:

```bash
# From BabaYaga directory
npm run chrome

# Or manually
chrome --remote-debugging-port=9222
```

### Testing Your Installation

1. **Test MCP servers:**
   ```bash
   npm run test:servers
   ```

2. **Run E2E test:**
   ```bash
   npm run test:e2e
   ```

3. **In Claude Code:**
   ```
   Using the puppeteer-babayaga tool, navigate to https://example.com
   ```

## Environment Variables

You can customize BabaYaga behavior with environment variables:

```bash
# Custom Chrome debugging port
CHROME_DEBUG_PORT=9223 npm run chrome

# Custom Chrome path
CHROME_PATH="/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary" npm run chrome
```

## Updating BabaYaga

### For submodule installations:
```bash
cd babayaga
git pull origin main
npm install
```

### For standalone installations:
```bash
git pull origin main
npm install
```

## Uninstalling

### Remove from project:
```bash
# Remove submodule
git submodule deinit -f babayaga
rm -rf .git/modules/babayaga
git rm -f babayaga

# Remove .mcp.json or edit it to remove BabaYaga servers
```

### Remove from user configuration:
```bash
claude mcp remove puppeteer-babayaga -s user
claude mcp remove cdp-babayaga -s user
```

## Troubleshooting

### Permission Errors
If you get permission errors, ensure you own the directories:
```bash
sudo chown -R $(whoami) ~/tools/babayaga
```

### Port Already in Use
If port 9222 is in use:
```bash
# Find what's using it
lsof -i :9222

# Use a different port
CHROME_DEBUG_PORT=9223 npm run chrome
```

### MCP Server Not Found
1. Check your current directory
2. Verify the `cwd` path in `.mcp.json` is correct
3. Ensure `npm install` completed successfully

## Advanced Configuration

### Custom MCP Names
You can use different names for the MCP servers:

```json
{
  "mcpServers": {
    "browser-automation": {
      "command": "npm",
      "args": ["run", "start:puppeteer-mcp"],
      "cwd": "./babayaga"
    },
    "browser-inspector": {
      "command": "npm",
      "args": ["run", "start:cdp-mcp"],
      "cwd": "./babayaga"
    }
  }
}
```

### Multiple Chrome Instances
Run BabaYaga with different Chrome instances:

```bash
# Terminal 1: Development Chrome
CHROME_DEBUG_PORT=9222 npm run chrome

# Terminal 2: Testing Chrome  
CHROME_DEBUG_PORT=9223 npm run chrome
```

Then configure different MCP servers for each port.

## Next Steps

- Read the [Tool Reference](tools-reference.md) to learn about all available tools
- Check out [E2E Examples](example-e2e-test.md) for real-world usage
- Join our community for support and updates