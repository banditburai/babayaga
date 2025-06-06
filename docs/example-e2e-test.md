# E2E Test Examples with BabaYaga

This document provides example end-to-end test scenarios using BabaYaga with Claude Desktop.

## Setup Prerequisites

Before running these examples:

1. Install and build BabaYaga:
   ```bash
   npm install
   npm run build
   ```

2. Configure Claude Desktop with BabaYaga (see [installation.md](installation.md))

3. Restart Claude Desktop to load the MCP server

## Example 1: Basic Navigation and Interaction

**Goal**: Navigate to a website and interact with elements

### Claude Prompts:

```
Navigate to https://example.com
```

```
Take a screenshot of the page
```

```
Click the "More information..." link
```

## Example 2: Form Filling and Submission

**Goal**: Fill out a form and submit it

### Claude Prompts:

```
Navigate to https://www.w3schools.com/html/html_forms.asp
```

```
Type "John Doe" in the firstname field
```

```
Type "Smith" in the lastname field
```

```
Click the submit button
```

```
Take a screenshot of the result
```

## Example 3: Waiting for Dynamic Content

**Goal**: Handle pages with dynamic content loading

### Claude Prompts:

```
Navigate to https://www.google.com
```

```
Type "OpenAI" in the search box
```

```
Press Enter
```

```
Wait for the search results to appear
```

```
Take a screenshot of the results
```

## Example 4: Working with Multiple Elements

**Goal**: Interact with multiple elements on a page

### Claude Prompts:

```
Navigate to https://en.wikipedia.org
```

```
Highlight all links on the page in red for 3 seconds
```

```
Get information about the search button
```

```
Take a full page screenshot
```

## Example 5: JavaScript Execution

**Goal**: Execute custom JavaScript on the page

### Claude Prompts:

```
Navigate to https://example.com
```

```
Execute JavaScript to count all links on the page
```

```
Execute JavaScript to change the page title to "Modified by BabaYaga"
```

```
Get the current page info including the new title
```

## Example 6: Advanced Screenshot Handling

**Goal**: Demonstrate smart screenshot capabilities

### Claude Prompts:

```
Navigate to https://en.wikipedia.org/wiki/Web_browser
```

```
Take a screenshot of just the infobox on the right
```
(This will likely return base64 as it's small)

```
Take a full page screenshot
```
(This will automatically save to file due to size)

```
Take a screenshot and save it as "wikipedia-browser-article"
```

## Example 7: Navigation History

**Goal**: Test browser navigation controls

### Claude Prompts:

```
Navigate to https://example.com
```

```
Navigate to https://wikipedia.org
```

```
Go back to the previous page
```

```
Go forward again
```

```
Reload the current page
```

## Tips for Writing E2E Tests

1. **Be Specific with Selectors**: Use IDs or unique classes when possible
   ```
   Click the element with selector "#submit-button"
   ```

2. **Wait for Elements**: Ensure elements are loaded before interacting
   ```
   Wait for the element ".results-container" to be visible
   ```

3. **Handle Errors Gracefully**: BabaYaga provides descriptive error messages
   - "Element not found" - Check your selector
   - "Navigation timeout" - Page may be slow or URL incorrect

4. **Use Full Page Screenshots Sparingly**: They automatically save to disk to avoid token limits

5. **Chain Operations**: Combine multiple operations in a single prompt for efficiency
   ```
   Navigate to example.com, wait for it to load, type "test" in the search box, and take a screenshot
   ```

## Debugging Tips

1. **Check Browser State**: Use `page_info` tool to verify current URL and page state

2. **Visual Debugging**: Use `highlight` tool to verify element selection

3. **Console Output**: Check the terminal running BabaYaga for browser console messages

4. **Screenshot Verification**: Screenshots are saved to the `screenshots/` directory

## Advanced Scenarios

### Handling Authentication

```
Navigate to the login page
Type the username
Type the password
Click the login button
Wait for the dashboard to appear
```

### Testing Responsive Design

```
Navigate to the website
Take a screenshot at default size
Set the viewport to mobile size (375x667)
Take another screenshot
Compare the layouts
```

### Performance Testing

```
Navigate to the page
Get page metrics
Execute JavaScript to measure specific timings
```

## Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Screenshot too large | Use auto mode (default) - it handles this automatically |
| Element not found | Verify selector, wait for element to be visible |
| Navigation timeout | Increase timeout or check URL |
| Browser not starting | Check if `HEADLESS=true` helps |