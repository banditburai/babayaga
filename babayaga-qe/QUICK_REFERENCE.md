# Babayaga-QE Quick Reference

## 🚀 Quick Start

```javascript
// 1. Check connection health
await mcp__babayaga-qe__cdp_health_check()

// 2. Sync with Playwright
await mcp__babayaga-qe__cdp_sync_playwright({
  playwrightCdpUrl: "http://localhost:9222"
})

// 3. Start measuring!
```

## 📏 Element Measurement

```javascript
// Basic measurement
await mcp__babayaga-qe__qa_measure_element({
  selector: "#logo"
})

// Full measurement with all options
await mcp__babayaga-qe__qa_measure_element({
  selector: "#logo",
  includeBoxModel: true,
  includeTypography: true
})
```

**Returns**: dimensions, boxModel, typography, spacing, visibility

## 📐 Distance Measurement

```javascript
await mcp__babayaga-qe__qa_measure_distances({
  elementA: "#header",
  elementB: "#content"
})
```

**Returns**: horizontal, vertical, diagonal distances + relationship

## 🎯 Grid Analysis

```javascript
await mcp__babayaga-qe__qa_analyze_layout_grid({
  elements: [".card:nth-child(1)", ".card:nth-child(2)", ".card:nth-child(3)"],
  tolerancePixels: 2
})
```

**Returns**: columns, rows, gutters, alignment issues

## 🔧 CDP Commands

```javascript
// Get DOM structure
await mcp__babayaga-qe__cdp_send_command({
  method: "DOM.getDocument",
  params: {}
})

// Execute JavaScript
await mcp__babayaga-qe__cdp_send_command({
  method: "Runtime.evaluate",
  params: { expression: "document.title" }
})
```

## 🎯 Common Selectors

```javascript
// ID
"#header"

// Class (first match)
".btn-primary"

// Attribute
"[data-testid='submit']"

// Complex
".container .card:first-child h3"

// Pseudo-selectors
"button:not(.disabled)"
```

## ⚠️ Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "No CDP client instance" | Not connected | Run `cdp_sync_playwright()` |
| "Element not found" | Bad selector or missing element | Check selector, wait for element |
| "Connection timeout" | Chrome not running | Start Chrome with `--remote-debugging-port=9222` |

## 🏃 Performance Tips

1. Use ID selectors (fastest)
2. Batch similar operations
3. Only include needed options
4. Limit grid analysis to <50 elements

## 🔄 Typical Workflow

```javascript
// 1. Health check
const health = await cdp_health_check();
if (health.overall !== "healthy") return;

// 2. Sync connection
await cdp_sync_playwright({ playwrightCdpUrl: "http://localhost:9222" });

// 3. Measure header
const header = await qa_measure_element({ 
  selector: "#header",
  includeBoxModel: true 
});

// 4. Check spacing
const spacing = await qa_measure_distances({
  elementA: "#header",
  elementB: "#content"
});

// 5. Validate grid
const grid = await qa_analyze_layout_grid({
  elements: [".card"],
  tolerancePixels: 5
});
```