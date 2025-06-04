# E2E Test Examples

This document provides example end-to-end test scenarios that demonstrate the combined use of Puppeteer MCP and CDP MCP servers with Claude Code.

## Setup Prerequisites

Before running these examples:

1. Start Chrome with remote debugging:
   ```bash
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug
   ```

2. Start the test application:
   ```bash
   npm run serve:test-app
   ```

3. Start both MCP servers (in separate terminals):
   ```bash
   npm run start:puppeteer-mcp
   npm run start:cdp-mcp
   ```

## Example 1: Console Log Confirmation Trial

**Goal**: Click a button and verify the console message

### Claude Code Prompts:

```
Using the Puppeteer tool, navigate to http://localhost:8888
```

```
Using the CDP tool, list available targets
```

```
Using the CDP tool, connect to the first target
```

```
Using the Puppeteer tool, click the element with selector #logButton
```

```
Using the CDP tool, get the last 5 console messages
```

### Expected Results:
- Navigation successful
- Button clicked
- Console shows: "Button clicked successfully"

## Example 2: Dynamic Style Change Trial

**Goal**: Change element style via CDP and confirm with both tools

### Claude Code Prompts:

```
Using the Puppeteer tool, navigate to http://localhost:8888
```

```
Using the CDP tool, connect to the first target
```

```
Using the CDP tool, get computed style for selector #headerBanner
```

```
Using the CDP tool, evaluate: 
document.getElementById('headerBanner').style.backgroundColor = 'rgb(0, 0, 255)'
```

```
Using the Puppeteer tool, take a screenshot
```

```
Using the CDP tool, get computed style for selector #headerBanner
```

### Expected Results:
- Initial background color: rgb(52, 152, 219)
- After change: rgb(0, 0, 255) (blue)
- Screenshot shows blue header

## Example 3: Form Input Processing

**Goal**: Enter text, process it, and verify DOM updates

### Claude Code Prompts:

```
Using the Puppeteer tool, navigate to http://localhost:8888
```

```
Using the CDP tool, connect
```

```
Using the Puppeteer tool, type "Hello BabaYaga" into the element with selector #userInput
```

```
Using the Puppeteer tool, click the button with text "Process Input"
```

```
Using the CDP tool, evaluate: document.getElementById('output').textContent
```

```
Using the CDP tool, get console messages with limit 3
```

### Expected Results:
- Input field populated with "Hello BabaYaga"
- Output shows: "Processed: HELLO BABAYAGA"
- Console shows: 'User input processed: "Hello BabaYaga"'

## Example 4: Error Handling Test

**Goal**: Trigger errors and monitor console

### Claude Code Prompts:

```
Using the Puppeteer tool, navigate to http://localhost:8888
```

```
Using the CDP tool, connect
```

```
Using the Puppeteer tool, click the element with selector #errorButton
```

```
Using the CDP tool, get console messages
```

```
Using the CDP tool, evaluate: 
throw new Error('Test error from CDP')
```

### Expected Results:
- Error button clicked
- Console shows error message
- CDP evaluation error is caught and reported

## Example 5: Multi-Tool Verification Flow

**Goal**: Complex scenario using both tools for comprehensive testing

### Claude Code Prompts:

```
Using the Puppeteer tool, navigate to http://localhost:8888
```

```
Using the CDP tool, connect
```

```
Using the CDP tool, evaluate: 
document.querySelectorAll('button').length
```

```
Using the Puppeteer tool, click the element with selector #changeStyleButton
```

```
Using the CDP tool, get computed style for selector #headerBanner
```

```
Using the CDP tool, get console messages with limit 2
```

```
Using the Puppeteer tool, click the button with text "Reset Header Style"
```

```
Using the CDP tool, evaluate:
document.getElementById('headerBanner').style.backgroundColor
```

```
Using the Puppeteer tool, take a screenshot
```

### Expected Results:
- Button count returned
- Style changed to blue
- Console confirms change
- Style reset to original
- Final screenshot shows reset state

## Example 6: Page State Validation

**Goal**: Validate page state across interactions

### Claude Code Prompts:

```
Using the Puppeteer tool, navigate to http://localhost:8888
```

```
Using the CDP tool, connect
```

```
Using the CDP tool, evaluate:
{
  title: document.title,
  buttonCount: document.querySelectorAll('button').length,
  hasConsoleOutput: document.getElementById('consoleOutput') !== null,
  headerText: document.querySelector('#headerBanner h1').textContent
}
```

```
Using the Puppeteer tool, click #logButton
```

```
Using the Puppeteer tool, click #errorButton
```

```
Using the Puppeteer tool, click #changeStyleButton
```

```
Using the CDP tool, evaluate:
Array.from(document.querySelectorAll('#consoleOutput > div'))
  .slice(-3)
  .map(el => el.textContent)
```

### Expected Results:
- Page state object with correct values
- Three console entries after button clicks
- Console shows mix of log, error, and info messages

## Best Practices

1. **Always connect CDP first** when using both tools
2. **Use Puppeteer for actions**, CDP for inspection
3. **Limit CDP queries** to avoid large responses
4. **Take screenshots** to visually confirm state
5. **Check console regularly** for JavaScript errors

## Debugging Tips

- If CDP commands fail, verify connection first
- Use `cdp_list_targets` to see available tabs
- Check Chrome is running with debugging enabled
- Verify selectors exist before interacting
- Monitor both server logs for errors