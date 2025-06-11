# Babayaga-QE Tool Usage Documentation

This documentation provides comprehensive usage examples and notes from testing all babayaga-qe tools. Each tool includes common use cases, edge cases, and practical tips.

## Table of Contents
1. [CDP Connection Tools](#cdp-connection-tools)
2. [Element Measurement Tool](#element-measurement-tool)
3. [Distance Measurement Tool](#distance-measurement-tool)
4. [Layout Grid Analysis Tool](#layout-grid-analysis-tool)
5. [Raw CDP Commands](#raw-cdp-commands)
6. [Common Issues & Solutions](#common-issues--solutions)

---

## CDP Connection Tools

### 1. cdp_health_check

**Purpose**: Check the overall health of the CDP connection and system

**Usage**:
```javascript
mcp__babayaga-qe__cdp_health_check()
```

**Response Structure**:
```json
{
  "overall": "healthy" | "unhealthy",
  "timestamp": "2025-06-06T22:53:39.854Z",
  "checks": {
    "cdpConnection": {
      "status": "pass" | "fail",
      "message": "CDP connection active",
      "duration": 0
    },
    "targetAvailability": {
      "status": "pass" | "fail", 
      "message": "1 target(s) available",
      "details": {
        "targetCount": 1,
        "targets": [...]
      }
    },
    "browserResponsiveness": {
      "status": "pass" | "fail",
      "message": "Browser responded in 1ms",
      "details": { "responseTime": 1 }
    },
    "systemResources": {
      "status": "pass",
      "message": "Memory usage: 12.9MB",
      "details": {
        "memory": { "heapUsed", "heapTotal", "external" },
        "cpu": { "user", "system" }
      }
    }
  },
  "metrics": {
    "uptime": 1107369,
    "totalCommands": 1,
    "failedCommands": 0,
    "averageResponseTime": 1
  }
}
```

**Key Points**:
- Always run this first to ensure connection is healthy
- Check `overall` status before proceeding with other tools
- Monitor `systemResources` for memory leaks
- `browserResponsiveness` indicates if browser is frozen

### 2. cdp_list_targets

**Purpose**: List all available browser targets (tabs, pages, workers)

**Usage**:
```javascript
mcp__babayaga-qe__cdp_list_targets()
```

**Response Example**:
```json
[
  {
    "id": "235F4FDDFDEE49ADC4A5E9975B4F5C8B",
    "type": "page",
    "title": "Test Page",
    "url": "https://example.com",
    "attached": true
  }
]
```

**Common Use Cases**:
- Find the correct target ID for connection
- Check if multiple tabs are open
- Verify page navigation worked

### 3. cdp_connect_target

**Purpose**: Connect to a specific browser target

**Usage**:
```javascript
// Connect to specific target
mcp__babayaga-qe__cdp_connect_target({
  targetId: "235F4FDDFDEE49ADC4A5E9975B4F5C8B"
})

// Connect to first available target
mcp__babayaga-qe__cdp_connect_target()
```

**Response**:
```json
{
  "connected": true,
  "targetId": "235F4FDDFDEE49ADC4A5E9975B4F5C8B"
}
```

### 4. cdp_sync_playwright

**Purpose**: Synchronize CDP connection with Playwright browser instance

**Usage**:
```javascript
mcp__babayaga-qe__cdp_sync_playwright({
  playwrightCdpUrl: "http://localhost:9222"
})
```

**Response**:
```json
{
  "synchronized": true,
  "playwrightCdpUrl": "http://localhost:9222",
  "connectedTarget": {
    "id": "...",
    "title": "...",
    "url": "..."
  },
  "enabledDomains": ["DOM", "CSS", "Runtime", "Page"],
  "availableTargets": 1
}
```

**Important**: Always run this after:
- Starting a new browser session
- Navigating to a new page
- Experiencing connection issues

---

## Element Measurement Tool

### qa_measure_element

**Purpose**: Measure comprehensive element properties including dimensions, box model, typography, and visibility

**Basic Usage**:
```javascript
// Minimal - just dimensions
mcp__babayaga-qe__qa_measure_element({
  selector: "#logo"
})

// Full measurement
mcp__babayaga-qe__qa_measure_element({
  selector: "#logo",
  includeBoxModel: true,
  includeTypography: true
})
```

**Selector Examples**:

1. **ID Selectors**:
```javascript
{ selector: "#header" }
{ selector: "#main-content" }
```

2. **Class Selectors**:
```javascript
{ selector: ".btn-primary" }  // First matching element
{ selector: ".card" }         // First card
```

3. **Tag Selectors**:
```javascript
{ selector: "h1" }            // First h1
{ selector: "button" }        // First button
```

4. **Attribute Selectors**:
```javascript
{ selector: "[data-testid='submit']" }
{ selector: "[role='navigation']" }
{ selector: "button[type='submit']" }
```

5. **Complex Selectors**:
```javascript
{ selector: ".container .card h3" }
{ selector: "nav > ul > li:first-child" }
{ selector: ".btn:not(.disabled)" }
```

**Response Structure**:
```json
{
  "selector": "#logo",
  "dimensions": {
    "width": 200,
    "height": 50,
    "x": 20,      // Position from left
    "y": 20       // Position from top
  },
  "boxModel": {
    "content": { "x": 20, "y": 20, "width": 200, "height": 50 },
    "padding": { "x": 20, "y": 20, "width": 200, "height": 50 },
    "border": { "x": 20, "y": 20, "width": 200, "height": 50 },
    "margin": { "x": 10, "y": 10, "width": 220, "height": 70 }
  },
  "typography": {
    "fontSize": "24px",
    "lineHeight": "1.5",
    "fontFamily": "Arial, sans-serif",
    "fontWeight": "700"
  },
  "spacing": {
    "marginTop": 10,
    "marginRight": 10,
    "marginBottom": 10,
    "marginLeft": 10,
    "paddingTop": 0,
    "paddingRight": 0,
    "paddingBottom": 0,
    "paddingLeft": 0
  },
  "visibility": {
    "isVisible": true,
    "opacity": 1,
    "zIndex": "auto"
  }
}
```

**Edge Cases Tested**:

1. **Hidden Elements**:
```javascript
// display: none
{ selector: ".hidden" }
// Returns: visibility.isVisible = false, dimensions may be 0

// visibility: hidden  
{ selector: ".invisible" }
// Returns: visibility.isVisible = false, dimensions preserved
```

2. **Non-existent Elements**:
```javascript
{ selector: "#does-not-exist" }
// Error: "Element not found: #does-not-exist"
```

3. **Invalid Selectors**:
```javascript
{ selector: "##invalid" }
// Error: "Failed to execute querySelector"
```

**Performance Notes**:
- Single element measurement: ~20-50ms
- Including box model adds ~10ms
- Including typography adds ~10ms
- Use specific selectors for better performance

---

## Distance Measurement Tool

### qa_measure_distances

**Purpose**: Calculate spatial relationships between two elements

**Usage**:
```javascript
mcp__babayaga-qe__qa_measure_distances({
  elementA: "#header",
  elementB: "#content"
})
```

**Response Structure**:
```json
{
  "elementA": "#header",
  "elementB": "#content",
  "distances": {
    "horizontal": 0,        // Horizontal distance between closest edges
    "vertical": 20,         // Vertical distance between closest edges
    "diagonal": 20,         // Direct distance between closest points
    "closestEdge": 20       // Minimum distance between any edges
  },
  "relationship": "above",   // "above", "below", "left", "right", "overlapping"
  "alignment": {
    "horizontalAlignment": "left",  // "left", "center", "right", "none"
    "verticalAlignment": "none"     // "top", "middle", "bottom", "none"
  }
}
```

**Common Use Cases**:

1. **Header to Content Spacing**:
```javascript
{
  elementA: "#header",
  elementB: "#main-content"
}
// Verify consistent spacing between sections
```

2. **Form Label to Input**:
```javascript
{
  elementA: "label[for='email']",
  elementB: "#email"
}
// Check accessibility spacing
```

3. **Button Spacing in Toolbar**:
```javascript
{
  elementA: ".btn-save",
  elementB: ".btn-cancel"
}
// Ensure consistent button spacing
```

4. **Card Grid Spacing**:
```javascript
{
  elementA: "[data-testid='card-1']",
  elementB: "[data-testid='card-2']"
}
// Validate grid gaps
```

**Relationship Types**:
- `above`: elementA is above elementB
- `below`: elementA is below elementB  
- `left`: elementA is to the left of elementB
- `right`: elementA is to the right of elementB
- `overlapping`: Elements overlap

**Alignment Detection**:
- Horizontal: Detects if elements share same left edge, center, or right edge
- Vertical: Detects if elements share same top edge, middle, or bottom edge
- Tolerance: ~2px for alignment detection

---

## Layout Grid Analysis Tool

### qa_analyze_layout_grid

**Purpose**: Analyze spacing consistency and grid patterns for multiple elements

**Usage**:
```javascript
mcp__babayaga-qe__qa_analyze_layout_grid({
  elements: [".card:nth-child(1)", ".card:nth-child(2)", ".card:nth-child(3)"],
  tolerancePixels: 2  // Optional, default is 2
})
```

**Response Structure**:
```json
{
  "elements": ["selector1", "selector2", "selector3"],
  "gridAnalysis": {
    "columnsDetected": 3,
    "rowsDetected": 1,
    "gutterWidth": 20,      // Horizontal spacing between elements
    "gutterHeight": 0,      // Vertical spacing between elements
    "alignmentIssues": []   // Elements that break grid alignment
  },
  "spacingConsistency": {
    "horizontalSpacings": [20, 20],  // All horizontal gaps
    "verticalSpacings": [],          // All vertical gaps
    "inconsistencies": []            // Spacing values that deviate
  }
}
```

**Common Patterns**:

1. **E-commerce Product Grid**:
```javascript
{
  elements: [
    ".product-card:nth-child(1)",
    ".product-card:nth-child(2)",
    ".product-card:nth-child(3)",
    ".product-card:nth-child(4)"
  ]
}
// Expected: 2x2 or 4x1 grid with consistent gutters
```

2. **Navigation Menu**:
```javascript
{
  elements: [".nav-item"],
  tolerancePixels: 1
}
// Expected: Single row, consistent spacing
```

3. **Form Fields**:
```javascript
{
  elements: ["#field1", "#field2", "#field3"],
  tolerancePixels: 5
}
// Expected: Single column, consistent vertical spacing
```

4. **Footer Links**:
```javascript
{
  elements: [".footer-column"],
  tolerancePixels: 10
}
// Expected: Multiple columns with equal spacing
```

**Interpreting Results**:

- **Perfect Grid**: 
  - `alignmentIssues` is empty
  - `inconsistencies` is empty
  - Clear column/row detection

- **Spacing Issues**:
  - Check `inconsistencies` for outlier values
  - Review `horizontalSpacings` for patterns

- **Alignment Problems**:
  - `alignmentIssues` lists misaligned elements
  - May indicate CSS or responsive issues

**Performance Considerations**:
- Scales linearly with element count
- 10 elements: ~50-100ms
- 50 elements: ~200-300ms
- 100+ elements: Consider batching

---

## Raw CDP Commands

### cdp_send_command

**Purpose**: Execute any Chrome DevTools Protocol command directly

**Usage**:
```javascript
mcp__babayaga-qe__cdp_send_command({
  method: "DOM.getDocument",
  params: {}
})
```

**Common Commands**:

1. **Get Document Structure**:
```javascript
{
  method: "DOM.getDocument",
  params: {}
}
```

2. **Execute JavaScript**:
```javascript
{
  method: "Runtime.evaluate",
  params: {
    expression: "document.title"
  }
}
```

3. **Take Screenshot**:
```javascript
{
  method: "Page.captureScreenshot",
  params: {
    format: "png"
  }
}
```

4. **Get Computed Styles**:
```javascript
{
  method: "CSS.getComputedStyleForNode",
  params: {
    nodeId: 123
  }
}
```

5. **Emulate Device**:
```javascript
{
  method: "Emulation.setDeviceMetricsOverride",
  params: {
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    mobile: true
  }
}
```

**Important Notes**:
- Requires knowledge of CDP API
- Some commands need prior setup (domains enabled)
- Node IDs are session-specific
- Use higher-level tools when possible

---

## Common Issues & Solutions

### 1. "No CDP client instance"

**Problem**: CDP connection not established
**Solution**:
```javascript
// Run sync first
mcp__babayaga-qe__cdp_sync_playwright({
  playwrightCdpUrl: "http://localhost:9222"
})
```

### 2. "Element not found"

**Possible Causes**:
- Element doesn't exist
- Page not fully loaded
- Wrong selector syntax
- Element in iframe

**Solutions**:
```javascript
// Wait for element
await page.waitForSelector("#my-element")

// Check simpler selector
{ selector: "h1" }  // Instead of complex selector

// Verify element exists
mcp__playwright__browser_snapshot()
```

### 3. Connection Timeouts

**Problem**: Commands timing out
**Solutions**:
- Check Chrome is running with `--remote-debugging-port=9222`
- Verify no firewall blocking localhost:9222
- Restart browser and babayaga-qe server

### 4. Measurement Inconsistencies

**Problem**: Different results between runs
**Solutions**:
- Ensure browser zoom is 100%
- Check viewport size is consistent
- Wait for animations to complete
- Disable smooth scrolling

### 5. Performance Issues

**Problem**: Slow measurements
**Solutions**:
- Use specific selectors (IDs are fastest)
- Batch related measurements
- Disable unnecessary options (box model, typography)
- Limit grid analysis element count

---

## Best Practices

1. **Always Start with Health Check**:
```javascript
const health = await cdp_health_check();
if (health.overall !== "healthy") {
  // Handle connection issues
}
```

2. **Use Specific Selectors**:
```javascript
// Good
{ selector: "#specific-id" }
{ selector: "[data-testid='unique']" }

// Avoid
{ selector: "div" }  // Too generic
{ selector: "*" }    // Will fail
```

3. **Handle Errors Gracefully**:
```javascript
try {
  const result = await qa_measure_element({ selector: "#test" });
} catch (error) {
  if (error.message.includes("Element not found")) {
    // Element doesn't exist
  }
}
```

4. **Batch Operations**:
```javascript
// Measure multiple elements efficiently
const elements = ["#header", "#content", "#footer"];
const measurements = await Promise.all(
  elements.map(selector => 
    qa_measure_element({ selector })
  )
);
```

5. **Monitor Performance**:
```javascript
const start = Date.now();
const result = await qa_measure_element({ selector: "#test" });
console.log(`Measurement took ${Date.now() - start}ms`);
```

---

## Integration Examples

### 1. Responsive Design Testing
```javascript
// Test at different viewports
const viewports = [
  { width: 1920, height: 1080 },  // Desktop
  { width: 768, height: 1024 },   // Tablet
  { width: 375, height: 667 }     // Mobile
];

for (const viewport of viewports) {
  await mcp__playwright__browser_resize(viewport);
  await cdp_sync_playwright({ playwrightCdpUrl: "http://localhost:9222" });
  
  const logo = await qa_measure_element({ selector: "#logo" });
  console.log(`Logo at ${viewport.width}px: ${logo.dimensions.width}px`);
}
```

### 2. Form Validation Testing
```javascript
// Check form field alignment
const fields = ["#name", "#email", "#message"];
const grid = await qa_analyze_layout_grid({
  elements: fields,
  tolerancePixels: 5
});

if (grid.gridAnalysis.columnsDetected !== 1) {
  console.error("Form fields not in single column!");
}

// Check label-to-field spacing
const labelSpacing = await qa_measure_distances({
  elementA: "label[for='email']",
  elementB: "#email"
});

if (labelSpacing.distances.vertical > 10) {
  console.error("Label too far from input field");
}
```

### 3. Component Library Testing
```javascript
// Test all buttons have consistent sizing
const buttons = await Promise.all([
  qa_measure_element({ selector: ".btn-primary" }),
  qa_measure_element({ selector: ".btn-secondary" }),
  qa_measure_element({ selector: ".btn-danger" })
]);

const heights = buttons.map(b => b.dimensions.height);
const uniqueHeights = [...new Set(heights)];

if (uniqueHeights.length > 1) {
  console.error("Inconsistent button heights:", uniqueHeights);
}
```

---

This documentation is based on extensive testing of the babayaga-qe tools and represents real-world usage patterns and edge cases discovered during testing.