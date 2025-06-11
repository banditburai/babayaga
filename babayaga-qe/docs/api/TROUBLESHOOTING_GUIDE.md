# Babayaga-QE Troubleshooting Guide

## Common Issues and Solutions

### 1. 🚫 "Element not found" Errors

**Symptoms**: 
- Error message: "Element not found: [selector]"
- Measurements fail even though element appears in browser

**Causes & Solutions**:

#### A. Page not fully loaded
```javascript
// ❌ Wrong
await page.goto(url);
await qa_measure_element({ selector: "#element" });

// ✅ Correct
await page.goto(url);
await cdp_sync_playwright({ playwrightCdpUrl: "http://localhost:9222" });
await qa_measure_element({ selector: "#element" });
```

#### B. Element is hidden (display: none)
- Hidden elements cannot be measured by CDP
- Check element visibility first:
```javascript
const isVisible = await page.isVisible("#element");
if (isVisible) {
  await qa_measure_element({ selector: "#element" });
}
```

#### C. Wrong selector syntax
```javascript
// ❌ Common mistakes
"##double-hash"  // Invalid
"#my id"         // Spaces need escaping
".class.name"    // Should be ".class-name" or ".class.name" for multiple classes

// ✅ Correct
"#single-hash"
"#my\\ id"       // Escaped space
".class-name"    // Single class
".class1.class2" // Multiple classes
```

### 2. 🔌 "No CDP client instance"

**Symptoms**:
- Error in health check
- All measurement tools fail

**Solution**:
```javascript
// Always sync after navigation or connection issues
await cdp_sync_playwright({ 
  playwrightCdpUrl: "http://localhost:9222" 
});
```

### 3. ⏱️ Connection Timeouts

**Symptoms**:
- Commands hang or timeout
- Browser appears frozen

**Causes & Solutions**:

#### A. Chrome not started with debugging port
```bash
# ✅ Start Chrome correctly
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222
```

#### B. Port already in use
```bash
# Check what's using port 9222
lsof -i :9222

# Kill the process if needed
kill -9 [PID]
```

#### C. Firewall blocking localhost
- Check firewall settings
- Try disabling firewall temporarily

### 4. 📐 Incorrect Measurements

**Symptoms**:
- Dimensions don't match visual appearance
- Box model values seem wrong

**Causes & Solutions**:

#### A. Browser zoom not 100%
- Reset zoom: Cmd+0 (Mac) or Ctrl+0 (Windows)
- Verify with: `window.devicePixelRatio` should be 1

#### B. CSS transforms affecting measurements
- Transformed elements return untransformed dimensions
- This is expected CDP behavior
- Measure before applying transforms if needed

#### C. Dynamic content changing
- Content may change between measurement calls
- Use consistent timing:
```javascript
// Wait for animations to complete
await page.waitForTimeout(500);
await qa_measure_element({ selector: "#animated" });
```

### 5. 📄 White/Blank Page Issues

**Symptoms**:
- Screenshot shows white page
- Elements not found despite correct navigation

**Causes & Solutions**:

#### A. Data URLs not rendering
```javascript
// ❌ Complex data URLs may fail
await page.goto('data:text/html,<complex html>');

// ✅ Use file URLs instead
await page.goto('file:///path/to/test.html');
```

#### B. Page requires user interaction
- Some pages need interaction to load content
- Click or scroll as needed:
```javascript
await page.click('body');
await page.waitForTimeout(100);
```

### 6. 🏃 Performance Issues

**Symptoms**:
- Measurements take too long
- Grid analysis times out

**Solutions**:

#### A. Use specific selectors
```javascript
// ❌ Slow
".item"  // Searches entire DOM

// ✅ Fast
"#specific-id"  // Direct lookup
"[data-testid='unique']"  // Indexed attribute
```

#### B. Batch operations
```javascript
// ❌ Slow - sequential
for (const id of ids) {
  await qa_measure_element({ selector: `#${id}` });
}

// ✅ Fast - parallel
await Promise.all(
  ids.map(id => qa_measure_element({ selector: `#${id}` }))
);
```

#### C. Limit grid analysis size
```javascript
// For large grids, sample instead of measuring all
const elements = items.slice(0, 20);  // First 20 only
await qa_analyze_layout_grid({ elements });
```

### 7. 🔄 Stale References

**Symptoms**:
- "Node not found" errors
- Measurements fail after page changes

**Solution**:
- Re-sync after any page modifications:
```javascript
// After dynamic content loads
await page.waitForSelector(".new-content");
await cdp_sync_playwright({ playwrightCdpUrl: "http://localhost:9222" });
await qa_measure_element({ selector: ".new-content" });
```

## Debug Checklist

When things aren't working, check in order:

1. **Take a screenshot** - Verify what's actually visible
   ```javascript
   await browser_take_screenshot({ filename: "debug.png" });
   ```

2. **Check health** - Ensure connection is good
   ```javascript
   const health = await cdp_health_check();
   console.log(health.overall);  // Should be "healthy"
   ```

3. **Verify element exists** - Use browser tools
   ```javascript
   const exists = await page.$eval(selector, el => !!el);
   ```

4. **Check CDP domains** - Ensure enabled
   ```javascript
   const sync = await cdp_sync_playwright();
   console.log(sync.enabledDomains);  // Should include DOM, CSS, Runtime, Page
   ```

5. **Test with simple selector** - Isolate the issue
   ```javascript
   await qa_measure_element({ selector: "body" });  // Should always work
   ```

## Getting Help

If issues persist:

1. **Collect diagnostics**:
   - Screenshot of the page
   - Health check output
   - Error messages with stack traces
   - Browser console errors

2. **Minimal reproduction**:
   - Create simple HTML file
   - Test with basic selectors
   - Document exact steps

3. **Check logs**:
   - CDP server logs
   - Browser console
   - Network tab for failed requests

Remember: Screenshots are your best debugging tool!