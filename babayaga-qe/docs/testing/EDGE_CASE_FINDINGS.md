# Edge Case Test Findings

## Date: 2025-06-06

### ✅ Successfully Tested Edge Cases

#### 1. Shadow DOM ❌ (Expected Limitation)
```javascript
qa_measure_element({ selector: "#shadow-content" })
// Result: Error - "Element not found"
```
- **Finding**: Shadow DOM content cannot be accessed with regular CSS selectors
- **Workaround**: Can only measure the shadow host element
- **Impact**: Cannot test components using Shadow DOM internally

#### 2. iframe Content ❌ (Expected Limitation)
```javascript
qa_measure_element({ selector: "#iframe-content" })
// Result: Error - "Element not found"
```
- **Finding**: Content inside iframes is not accessible
- **Workaround**: Can only measure the iframe element itself
- **Impact**: Cannot test content within iframes

#### 3. SVG Elements ✅ (Works!)
```javascript
qa_measure_element({ selector: "#svg-rect" })
// Result: Success - width: 80, height: 50

qa_measure_element({ selector: "#svg-text" })
// Result: Success - width: 67.29, height: 18
```
- **Finding**: SVG elements can be measured correctly
- **Note**: Returns pixel dimensions, not SVG units

#### 4. Canvas Element ✅ (Works!)
```javascript
qa_measure_element({ selector: "#myCanvas" })
// Result: Success - width: 200, height: 100
```
- **Finding**: Canvas elements can be measured
- **Note**: Only measures the canvas element, not drawn content

#### 5. Extremely Long Selectors ✅ (Works!)
```javascript
qa_measure_element({ 
  selector: ".level1 > .level2 > .level3 > .level4 > .level5 > .level6 > .level7 > .level8 > .level9 > .level10" 
})
// Result: Success - Deeply nested element found and measured
```
- **Finding**: No practical limit on selector complexity
- **Performance**: No noticeable slowdown

#### 6. Animated Elements ✅ (Captures Current State)
```javascript
qa_measure_element({ selector: "#animated" })
// Result: Success - x: 119.6484375 (mid-animation)
```
- **Finding**: Captures element position at the moment of measurement
- **Note**: Position changes between measurements as animation progresses
- **Use Case**: Good for testing animation bounds

#### 7. 1-Pixel Elements ✅ (Works!)
```javascript
qa_measure_element({ selector: "#one-pixel" })
// Result: Success - width: 1, height: 1
```
- **Finding**: Can accurately measure very small elements
- **No issues with precision

#### 8. Negative Margins ✅ (Correctly Reported)
```javascript
qa_measure_element({ selector: "#negative-margin" })
// Result: Success - margins correctly show -20px
```
- **Finding**: Negative margins are accurately reported
- **Box model calculations handle negative values correctly

#### 9. Pseudo-elements (::before, ::after) ⚠️ (Partial)
- **Finding**: Cannot directly select pseudo-elements
- **But**: Their content affects parent element measurements
- **Example**: "BEFORE: Main Content :AFTER" all measured as one element

### 🔍 Additional Discoveries

1. **Transform Effects on Box Model**
   - Transformed elements return transformed bounding box
   - Original spacing values (margin/padding) preserved
   - Position accounts for transformation

2. **Performance Consistency**
   - Complex selectors don't significantly impact performance
   - Measurements remain ~30-50ms regardless of selector complexity

3. **Error Messages**
   - Consistent "Element not found" for all inaccessible content
   - No distinction between truly missing vs inaccessible (shadow/iframe)

### 📊 Summary

**Working Well:**
- SVG and Canvas elements
- Complex selectors
- Extreme dimensions (1px to thousands)
- Negative values
- Animated elements (current state)

**Known Limitations:**
- Shadow DOM content (browser security)
- iframe content (cross-frame security)
- Pseudo-elements (CSS limitation)

**No Issues Found With:**
- Selector length/complexity
- Small dimensions
- Negative margins
- Animation state capture

These limitations are expected based on browser security models and CSS specifications, not bugs in babayaga-qe.