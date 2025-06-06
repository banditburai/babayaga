# Screenshot Workflow with BabaYaga

BabaYaga includes a smart screenshot tool that automatically handles MCP token limits by deciding whether to return base64 data or save to disk based on image size.

## The Smart Screenshot Tool

### Overview

The `screenshot` tool intelligently handles the MCP 25,000 token limit issue:
- **Small screenshots** (< 20KB): Returns base64 data directly
- **Large screenshots** (≥ 20KB): Automatically saves to disk and returns filepath

This means you don't need to worry about token limits - the tool handles it for you!

### Tool Parameters

- `fullPage` (boolean, optional): Capture entire page instead of just viewport
- `selector` (string, optional): CSS selector to capture specific element
- `output` (string, optional): Force output mode - `"auto"` (default), `"file"`, or `"base64"`
- `filename` (string, optional): Custom filename when saving to disk

## Example Workflows

### Basic Screenshot (Auto Mode)

```javascript
// Simple screenshot - tool decides what to do
await screenshot({});

// For a small viewport screenshot, you'll get:
{
  "success": true,
  "saved": false,
  "data": "iVBORw0KGgoAAAANS...",
  "format": "base64",
  "size": 15360,
  "sizeHuman": "15.0KB"
}
```

### Full Page Screenshot

```javascript
// Full page screenshots are usually large
await screenshot({ fullPage: true });

// Tool automatically saves to disk:
{
  "success": true,
  "saved": true,
  "filepath": "screenshots/screenshot-1704825600000.png",
  "filename": "screenshot-1704825600000.png",
  "size": 2097152,
  "sizeHuman": "2048.0KB"
}
```

### Element Screenshot

```javascript
// Capture specific element
await screenshot({ 
  selector: "#header",
  filename: "site-header"
});

// Small element returns base64:
{
  "success": true,
  "saved": false,
  "data": "iVBORw0KGgoAAAANS...",
  "format": "base64",
  "size": 8192,
  "sizeHuman": "8.0KB"
}
```

### Force File Output

```javascript
// Always save to disk, even for small images
await screenshot({ 
  selector: "#logo",
  output: "file",
  filename: "company-logo"
});

// Always saves to disk:
{
  "success": true,
  "saved": true,
  "filepath": "screenshots/company-logo.png",
  "filename": "company-logo.png",
  "size": 4096,
  "sizeHuman": "4.0KB"
}
```

## Claude Desktop Usage

When using with Claude Desktop, just ask naturally:

> "Take a screenshot of the current page"

> "Capture the full page"

> "Screenshot just the navigation menu"

> "Take a screenshot and save it as homepage"

Claude will use the appropriate parameters, and BabaYaga handles the rest!

## Understanding the Response

### When `saved: false`
- Screenshot was small enough to return as base64
- Data is in the `data` field
- Use this data directly for analysis or display

### When `saved: true`
- Screenshot was too large for MCP tokens
- File saved to disk at `filepath`
- Use the filepath to reference the image

## Configuration

### Screenshot Directory
By default, screenshots are saved to `./screenshots/` relative to BabaYaga's directory.

Configure with environment variable:
```bash
SCREENSHOT_PATH=/custom/path/to/screenshots
```

### Size Threshold
The 20KB threshold is conservative to ensure we stay well under MCP's limit. This accounts for:
- Base64 encoding overhead (33% increase)
- JSON response wrapper
- Safety margin

## Best Practices

1. **Use Auto Mode**: Let the tool decide - it knows the limits
2. **Meaningful Filenames**: When you need to find screenshots later
3. **Check Response Type**: Look at `saved` field to know how to handle the result
4. **Full Page Sparingly**: Full page screenshots are almost always saved to disk

## Common Scenarios

### Visual Testing
```javascript
// Baseline screenshot
await screenshot({ 
  selector: ".product-card",
  filename: "product-card-baseline"
});

// After changes
await screenshot({ 
  selector: ".product-card",
  filename: "product-card-updated"
});
```

### Documentation
```javascript
// Force file output for documentation
await screenshot({ 
  fullPage: true,
  output: "file",
  filename: "full-page-documentation"
});
```

### Quick Checks
```javascript
// Let auto mode handle it
await screenshot({});
// Small = inline data, Large = saved file
```

## Troubleshooting

### "Token limit exceeded" errors
- Should not happen with default settings
- Check if you're forcing `output: "base64"` on large images
- Let auto mode handle it instead

### Can't find saved screenshots
- Check `SCREENSHOT_PATH` environment variable
- Default location is `./screenshots/`
- Look for the filepath in the response

### Need the base64 data for a large screenshot
- Not recommended due to token limits
- If absolutely needed: `output: "base64"`
- Consider processing the saved file instead