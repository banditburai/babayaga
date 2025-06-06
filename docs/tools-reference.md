# BabaYaga Tools Reference

This guide covers all available tools in the unified BabaYaga server.

## Browser Control Tools

Core browser automation capabilities for navigation and interaction.

### Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `navigate` | Navigate to a URL | `url` (required), `waitUntil` (optional: 'load', 'domcontentloaded', 'networkidle0', 'networkidle2') |
| `click` | Click an element | `selector` (required), `clickCount` (optional, default: 1) |
| `type` | Type text into input | `selector` (required), `text` (required), `clear` (optional), `delay` (optional) |
| `wait` | Wait for conditions | `selector` (optional), `timeout` (optional), `visible` (optional), `hidden` (optional) |
| `evaluate` | Execute JavaScript | `code` (required) |
| `page_info` | Get page information | `includeMetrics` (optional) |
| `go_back` | Navigate back | None |
| `go_forward` | Navigate forward | None |
| `reload` | Reload page | `waitUntil` (optional) |

### Examples

```javascript
// Navigate to a page
await navigate({ url: "https://example.com" });

// Click a button
await click({ selector: "#submit-button" });

// Type with clearing first
await type({ 
  selector: "#email", 
  text: "user@example.com", 
  clear: true 
});

// Wait for element to appear
await wait({ 
  selector: ".results", 
  visible: true, 
  timeout: 5000 
});

// Execute JavaScript
await evaluate({ 
  code: "document.title" 
});
```

## Visual Tools

Tools for screenshots and visual operations.

### Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `screenshot` | Smart screenshot with MCP token handling | `fullPage` (optional), `selector` (optional), `output` (optional: 'auto', 'file', 'base64'), `filename` (optional) |
| `highlight` | Highlight elements | `selector` (required), `color` (optional), `duration` (optional) |
| `get_element_info` | Get element details | `selector` (required) |

### Screenshot Tool Details

The `screenshot` tool automatically handles MCP token limits:

#### Auto Mode (default)
- Small screenshots (< 20KB): Returns base64 data
- Large screenshots (≥ 20KB): Saves to disk and returns filepath

#### Examples

```javascript
// Basic screenshot (auto mode)
await screenshot({});

// Full page screenshot (will save to file)
await screenshot({ fullPage: true });

// Element screenshot with custom filename
await screenshot({ 
  selector: ".header",
  output: "file",
  filename: "header-screenshot"
});

// Force base64 output (careful with large images)
await screenshot({ 
  output: "base64",
  fullPage: true 
});
```

#### Response Formats

**Base64 Response:**
```json
{
  "success": true,
  "saved": false,
  "data": "iVBORw0KGgoAAAANS...",
  "format": "base64",
  "size": 15360,
  "sizeHuman": "15.0KB"
}
```

**File Response:**
```json
{
  "success": true,
  "saved": true,
  "filepath": "screenshots/screenshot-1234567890.png",
  "filename": "screenshot-1234567890.png",
  "size": 1048576,
  "sizeHuman": "1024.0KB"
}
```

### Other Visual Tools

```javascript
// Highlight elements
await highlight({ 
  selector: ".important", 
  color: "red",
  duration: 3000 
});

// Get element information
await get_element_info({ 
  selector: "#header" 
});
// Returns: tagName, id, className, text, visibility, position, styles
```

## Tool Response Patterns

All tools follow consistent response patterns:

### Success Response
```json
{
  "success": true,
  // Tool-specific data
}
```

### Error Response
Tools throw errors with descriptive messages:
- "Element not found: [selector]"
- "Navigation failed: [reason]"
- "Evaluation failed: [error]"

## Best Practices

1. **Wait After Navigation**: Use `waitUntil: 'networkidle2'` for SPAs
2. **Check Element Existence**: Use `wait` before interacting
3. **Handle Dynamic Content**: Use `evaluate` for complex interactions
4. **Screenshot Size**: Let auto mode handle token limits
5. **Error Handling**: Tools throw descriptive errors - handle appropriately

## Advanced Usage

### Chaining Operations
```javascript
// Login flow example
await navigate({ url: "https://example.com/login" });
await wait({ selector: "#email", visible: true });
await type({ selector: "#email", text: "user@example.com" });
await type({ selector: "#password", text: "password" });
await click({ selector: "#login-button" });
await wait({ selector: ".dashboard", timeout: 10000 });
```

### Custom Waiting
```javascript
// Wait for specific text
await evaluate({ 
  code: `
    await new Promise(resolve => {
      const check = setInterval(() => {
        if (document.body.textContent.includes('Success')) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  `
});
```

## Environment Variables

Configure BabaYaga behavior:

- `HEADLESS`: Run browser in headless mode
- `START_URL`: Initial page to load
- `SCREENSHOT_PATH`: Directory for screenshots
- `BROWSER_ARGS`: Additional Chrome arguments