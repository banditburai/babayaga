# Quick Test Script for Babayaga-QE

A rapid test script to verify babayaga-qe functionality in under 2 minutes.

## Setup Test Page

```html
<!-- Save as test.html and open in Chrome -->
<!DOCTYPE html>
<html>
<head>
    <style>
        body { margin: 0; padding: 20px; font-family: Arial; }
        #header { background: #333; color: white; padding: 20px; }
        .card { border: 1px solid #ddd; padding: 15px; margin: 10px; width: 200px; float: left; }
        .btn { padding: 10px 20px; margin: 5px; background: #007bff; color: white; border: none; }
        .hidden { display: none; }
        .invisible { visibility: hidden; }
    </style>
</head>
<body>
    <div id="header">
        <h1 id="logo">Test Site</h1>
        <nav>
            <a href="#" class="nav-link">Home</a>
            <a href="#" class="nav-link">About</a>
            <a href="#" class="nav-link">Contact</a>
        </nav>
    </div>
    
    <main id="content">
        <div class="card" data-testid="card-1">
            <h2>Card 1</h2>
            <p>Description text</p>
            <button class="btn">Click Me</button>
        </div>
        <div class="card" data-testid="card-2">
            <h2>Card 2</h2>
            <p>Description text</p>
            <button class="btn">Click Me</button>
        </div>
        <div class="card" data-testid="card-3">
            <h2>Card 3</h2>
            <p>Description text</p>
            <button class="btn">Click Me</button>
        </div>
        <div style="clear:both"></div>
        
        <div class="hidden">Hidden Element</div>
        <div class="invisible">Invisible Element</div>
    </main>
</body>
</html>
```

## Quick Test Commands

```bash
# 1. Start Chrome with debugging
# macOS:
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# 2. Start babayaga-qe server
cd babayaga-qe
npm run dev

# 3. Open test.html in the Chrome instance
```

## Test Execution Checklist

### ✅ Basic Connectivity (30 seconds)
```javascript
// Test 1: Health Check
cdp_health_check()
// Expected: "overall": "healthy"

// Test 2: List Targets
cdp_list_targets()
// Expected: Array with at least one target

// Test 3: Connect to Target
cdp_connect_target()
// Expected: "connected": true
```

### ✅ Element Measurements (30 seconds)
```javascript
// Test 4: Measure by ID
qa_measure_element({ selector: "#logo" })
// Expected: dimensions, typography, visibility data

// Test 5: Measure by Class
qa_measure_element({ selector: ".btn" })
// Expected: First button measurements

// Test 6: Measure with Box Model
qa_measure_element({ 
    selector: ".card",
    includeBoxModel: true,
    includeTypography: true
})
// Expected: Complete measurements including padding/margin
```

### ✅ Distance Calculations (30 seconds)
```javascript
// Test 7: Header to Content Distance
qa_measure_distances({
    elementA: "#header",
    elementB: "#content"
})
// Expected: vertical distance ~20px

// Test 8: Card to Card Distance
qa_measure_distances({
    elementA: "[data-testid='card-1']",
    elementB: "[data-testid='card-2']"
})
// Expected: horizontal distance ~10px

// Test 9: Logo to Nav Distance
qa_measure_distances({
    elementA: "#logo",
    elementB: "nav"
})
// Expected: relationship and alignment data
```

### ✅ Grid Analysis (30 seconds)
```javascript
// Test 10: Card Grid Layout
qa_analyze_layout_grid({
    elements: [".card:nth-child(1)", ".card:nth-child(2)", ".card:nth-child(3)"],
    tolerancePixels: 2
})
// Expected: 3 columns, 1 row, consistent spacing

// Test 11: Navigation Items
qa_analyze_layout_grid({
    elements: [".nav-link"],
    tolerancePixels: 2
})
// Expected: Single row detection

// Test 12: Buttons in Cards
qa_analyze_layout_grid({
    elements: [".card .btn"],
    tolerancePixels: 5
})
// Expected: Grid pattern with alignment data
```

### ✅ Error Cases (15 seconds)
```javascript
// Test 13: Non-existent Element
qa_measure_element({ selector: "#does-not-exist" })
// Expected: Error "Element not found"

// Test 14: Hidden Element
qa_measure_element({ selector: ".hidden" })
// Expected: Success with visibility.isVisible = false

// Test 15: Invalid Selector
qa_measure_element({ selector: "##invalid" })
// Expected: Error with selector syntax message
```

### ✅ Performance Check (15 seconds)
```javascript
// Test 16: Rapid Measurements
const start = Date.now();
for (let i = 0; i < 10; i++) {
    await qa_measure_element({ selector: ".card" });
}
const elapsed = Date.now() - start;
// Expected: < 500ms for 10 measurements

// Test 17: CDP Raw Command
cdp_send_command({
    method: "DOM.getDocument",
    params: {}
})
// Expected: Document root node
```

## Results Summary

| Test Category | Pass | Fail | Time |
|--------------|------|------|------|
| Connectivity | [ ] | [ ] | 30s |
| Measurements | [ ] | [ ] | 30s |
| Distances    | [ ] | [ ] | 30s |
| Grid Analysis| [ ] | [ ] | 30s |
| Error Cases  | [ ] | [ ] | 15s |
| Performance  | [ ] | [ ] | 15s |

**Total Time**: ~2 minutes

## Common Issues & Solutions

1. **"No CDP client instance"**
   - Solution: Run `cdp_sync_playwright()` first

2. **"Element not found"**
   - Check selector syntax
   - Verify element exists in DOM
   - Try simpler selector

3. **Timeout errors**
   - Check Chrome is running with `--remote-debugging-port=9222`
   - Verify no firewall blocking localhost:9222

4. **Measurement differences**
   - Browser zoom should be 100%
   - Check viewport size consistency

---
*Use this quick test to verify babayaga-qe is working correctly before running the full test suite.*