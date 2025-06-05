# Screenshot Workflow with BabaYaga

BabaYaga now includes tools for saving screenshots locally after capturing them with Puppeteer.

## Available Screenshot Tools

### 1. `puppeteer_screenshot`
Takes a screenshot of the current page and returns it as base64 data.

**Arguments:**
- `name` (string): Name/identifier for the screenshot

**Returns:**
- Base64 encoded image data

### 2. `save_screenshot` 
Saves base64 image data to a local file in the `./screenshots` directory.

**Arguments:**
- `base64Data` (string, required): Base64 encoded image data (with or without data URL prefix)
- `filename` (string, optional): Filename for the screenshot. If not provided, generates timestamp-based name.

**Returns:**
- Success status, filepath, file size, and timestamp

### 3. `list_screenshots`
Lists all saved screenshots in the screenshots directory.

**Arguments:** None

**Returns:**
- Count of screenshots and details for each (filename, path, size, timestamps)

## Example Workflow

Here's how an AI agent would capture and save a screenshot:

```json
// Step 1: Navigate to a page
{
  "tool": "puppeteer_navigate",
  "arguments": {
    "url": "http://localhost:8888"
  }
}

// Step 2: Capture screenshot (returns base64 data)
{
  "tool": "puppeteer_screenshot", 
  "arguments": {
    "name": "test-page"
  }
}

// Step 3: Save the screenshot locally
{
  "tool": "save_screenshot",
  "arguments": {
    "base64Data": "<base64 data from step 2>",
    "filename": "test-page-screenshot.png"
  }
}

// Step 4: List all saved screenshots
{
  "tool": "list_screenshots",
  "arguments": {}
}
```

## Key Points

1. **Puppeteer returns data, doesn't save**: The `puppeteer_screenshot` tool captures images but only returns the base64 data. It doesn't save files locally.

2. **Explicit saving step**: Use `save_screenshot` to persist the image data to disk.

3. **Automatic directory creation**: The screenshots directory is created automatically if it doesn't exist.

4. **Flexible filenames**: You can specify custom filenames or let the system generate timestamp-based names.

5. **Data URL support**: The `save_screenshot` tool handles base64 data with or without the `data:image/png;base64,` prefix.

## Implementation Details

The screenshot tools are built into the BabaYaga server as native tools, alongside visual-regression testing. They're available immediately when the server starts and don't require any additional services.

The saved screenshots are stored in `./screenshots/` relative to where BabaYaga is running.