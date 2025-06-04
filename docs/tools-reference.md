# BabaYaga Tools Reference

This guide covers all available tools in both Puppeteer MCP and CDP MCP servers.

## Puppeteer MCP Tools

Puppeteer provides high-level browser automation capabilities.

### Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `puppeteer_connect_active_tab` | Connect to existing Chrome instance | `targetUrl` (optional), `debugPort` (default: 9222) |
| `puppeteer_navigate` | Navigate to a URL | `url` (required) |
| `puppeteer_screenshot` | Capture screenshots | `name` (required), `selector` (optional), `width` (default: 800), `height` (default: 600) |
| `puppeteer_click` | Click an element | `selector` (required) |
| `puppeteer_fill` | Fill input field | `selector` (required), `value` (required) |
| `puppeteer_select` | Select dropdown option | `selector` (required), `value` (required) |
| `puppeteer_hover` | Hover over element | `selector` (required) |
| `puppeteer_evaluate` | Execute JavaScript | `script` (required) |

### Example Usage

```javascript
// Navigate to a page
await puppeteer_navigate({ url: "https://example.com" });

// Click a button
await puppeteer_click({ selector: "#submit-button" });

// Fill a form
await puppeteer_fill({ 
  selector: "input[name='email']", 
  value: "test@example.com" 
});

// Take a screenshot
await puppeteer_screenshot({ 
  name: "homepage",
  selector: ".main-content",
  width: 1200,
  height: 800
});
```

## CDP MCP Tools

CDP provides low-level access to Chrome DevTools Protocol for deep browser inspection.

### Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `cdp_connect` | Connect to Chrome DevTools | `targetId` (optional) |
| `cdp_list_targets` | List all browser tabs | None |
| `cdp_evaluate` | Execute JavaScript via CDP | `expression` (required) |
| `cdp_get_console_messages` | Get console messages | `limit` (default: 10) |
| `cdp_get_computed_style` | Get element's computed CSS | `selector` (required) |

### Example Usage

```javascript
// Connect to Chrome
await cdp_connect();

// Execute JavaScript
const title = await cdp_evaluate({ 
  expression: "document.title" 
});

// Get console messages
const logs = await cdp_get_console_messages({ 
  limit: 5 
});

// Inspect styles
const styles = await cdp_get_computed_style({ 
  selector: ".header" 
});
```

## When to Use Which Tool

### Use Puppeteer Tools for:
- Page navigation
- User interactions (clicks, typing)
- Taking screenshots
- High-level page automation
- Simulating user behavior

### Use CDP Tools for:
- Console log monitoring
- JavaScript execution with direct results
- Style inspection and debugging
- Low-level browser state access
- Performance monitoring

## Working with Both Tools Together

Many tasks benefit from using both tool sets:

```javascript
// Example: Click button and verify console output
await puppeteer_click({ selector: "#log-button" });
const messages = await cdp_get_console_messages({ limit: 1 });

// Example: Change styles and capture result
await cdp_evaluate({ 
  expression: "document.body.style.backgroundColor = 'red'" 
});
await puppeteer_screenshot({ name: "red-background" });

// Example: Debug form submission
await puppeteer_fill({ selector: "#email", value: "test@test.com" });
await puppeteer_click({ selector: "#submit" });
const errors = await cdp_get_console_messages({ limit: 5 });
```

## Tool Limitations

### Puppeteer Limitations
- Requires Chrome to be running with debugging enabled
- Screenshots return base64 encoded data
- Some actions may need wait time between operations

### CDP Limitations
- Must connect before using other CDP tools
- Large responses may be truncated
- Binary data (like images) is base64 encoded
- Connection is stateful (persists between calls)

## Error Handling

Common errors and solutions:

| Error | Solution |
|-------|----------|
| "Not connected to Chrome DevTools" | Run `cdp_connect` first |
| "Chrome not found" | Start Chrome with `npm run chrome` |
| "Element not found" | Verify selector exists, add wait if needed |
| "Port already in use" | Check for existing Chrome instances |

## Best Practices

1. **Always connect first**: Both tools need Chrome running
2. **Use specific selectors**: ID selectors are most reliable
3. **Handle async operations**: Add appropriate waits
4. **Check console for errors**: Use `cdp_get_console_messages` regularly
5. **Clean up state**: Close connections when done

## Advanced Usage

### Custom Wait Conditions
```javascript
// Wait for element before clicking
await cdp_evaluate({ 
  expression: `
    await new Promise(resolve => {
      const observer = new MutationObserver(() => {
        if (document.querySelector('.dynamic-content')) {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  `
});
await puppeteer_click({ selector: ".dynamic-content" });
```

### Performance Monitoring
```javascript
// Measure page load time
await cdp_evaluate({ expression: "performance.mark('start')" });
await puppeteer_navigate({ url: "https://example.com" });
await cdp_evaluate({ expression: "performance.mark('end')" });
const metrics = await cdp_evaluate({ 
  expression: "performance.measure('pageLoad', 'start', 'end'); performance.getEntriesByName('pageLoad')[0].duration" 
});
```