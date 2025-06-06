# BabaYaga Unified Architecture Design

## Executive Summary

This document outlines the redesigned BabaYaga architecture based on MCP best practices research and architectural analysis. The new design consolidates multiple MCP servers into a single, unified server that provides browser automation capabilities through a modular tool system.

## Architecture Decision

After analyzing three architectural options and researching MCP best practices, we've chosen the **Single Unified MCP Server** pattern for the following reasons:

1. **Simplicity**: One server, one connection, one tool namespace
2. **MCP Best Practice**: "Start small, scale incrementally"
3. **Performance**: Shared browser instance, no IPC overhead
4. **User Experience**: Clients only need one connection
5. **Maintainability**: Single codebase with modular tool organization

## Core Architecture

```
┌─────────────────┐
│   MCP Client    │
│ (Claude, etc.)  │
└────────┬────────┘
         │ stdio
┌────────▼────────┐
│ BabaYaga Server │
│  (Single MCP)   │
├─────────────────┤
│   Browser Pool  │
│   (Puppeteer)   │
├─────────────────┤
│ Tool Registry   │
├─────────────────┤
│ Browser Tools   │
│ Visual Tools    │
│ Performance     │
└─────────────────┘
```

## Key Design Principles

### 1. Single Process Architecture
- Everything runs in one Node.js process
- No subprocess management or IPC complexity
- Direct control over browser instances
- Simplified error handling and debugging

### 2. Modular Tool Organization
- Tools grouped by capability type
- Easy to add/remove tool modules
- Clear separation of concerns
- Testable in isolation

### 3. MCP Best Practices Applied
- **Transport**: stdio for local single-client use
- **Security**: Input validation, path sanitization
- **Lifecycle**: Proper initialization and shutdown
- **Error Handling**: Robust error propagation
- **Type Safety**: Full TypeScript implementation

## Implementation Structure

```typescript
// Core server structure
class UnifiedBabaYaga {
  private mcpServer: Server;
  private browser: Browser;
  private toolRegistry: ToolRegistry;
  
  constructor(config: BabaYagaConfig) {
    this.toolRegistry = new ToolRegistry();
    this.registerDefaultTools();
  }
  
  // Modular tool registration
  private registerDefaultTools() {
    this.registerBrowserTools();    // Navigation, clicking, typing
    this.registerVisualTools();      // Screenshots, visual regression
    this.registerPerformanceTools(); // Metrics, profiling
  }
}
```

## Tool Categories

### 1. Browser Control Tools
- `navigate` - Navigate to URLs
- `click` - Click elements
- `type` - Type text into inputs
- `wait` - Wait for conditions
- `evaluate` - Execute JavaScript

### 2. Visual Testing Tools
- `screenshot` - Capture screenshots
- `visual_diff` - Compare screenshots
- `highlight` - Highlight elements
- `save_screenshot` - Save to disk

### 3. Performance Tools
- `metrics` - Get performance metrics
- `coverage` - Code coverage analysis
- `network` - Monitor network activity
- `console` - Capture console logs

### 4. Page Information Tools
- `page_info` - Get page metadata
- `elements` - Query DOM elements
- `accessibility` - A11y tree info

## Configuration

```typescript
interface BabaYagaConfig {
  // Browser settings
  headless?: boolean;
  browserArgs?: string[];
  defaultViewport?: Viewport | null;
  
  // Tool settings
  screenshotPath?: string;
  enablePerformanceTools?: boolean;
  
  // MCP settings
  serverName?: string;
  serverVersion?: string;
}
```

## Security Considerations

1. **Input Validation**
   - Validate all tool arguments
   - Sanitize file paths
   - Check URL schemes

2. **Resource Limits**
   - Timeout for long-running operations
   - Memory usage monitoring
   - Concurrent operation limits

3. **Access Control**
   - No file system access outside designated directories
   - No execution of arbitrary code
   - Controlled browser permissions

## Migration Path

### Phase 1: Clean Implementation
- Create new unified server from scratch
- Implement core browser tools
- Add MCP protocol handling

### Phase 2: Tool Migration
- Port existing Puppeteer tools
- Add CDP-specific functionality
- Implement visual regression tools

### Phase 3: Testing & Validation
- Comprehensive test suite
- Performance benchmarking
- Error scenario testing

### Phase 4: Documentation & Examples
- API documentation
- Tool usage examples
- Integration guides

## Benefits Over Current Architecture

1. **Eliminated Complexity**
   - No stdio piping between processes
   - No service discovery needed
   - No Express server required
   - No multiple MCP server coordination

2. **Improved Reliability**
   - Single process = single point of control
   - Direct error handling
   - No silent subprocess failures
   - Clear lifecycle management

3. **Better Developer Experience**
   - Standard Node.js debugging
   - Simple local development
   - Clear code organization
   - Easy to extend

## Next Steps

1. Set up clean worktree with new branch
2. Implement core `UnifiedBabaYaga` class
3. Create modular tool system
4. Add MCP protocol handling
5. Implement essential browser tools
6. Create comprehensive test suite

## Example Usage

```typescript
// Simple usage
const babayaga = new UnifiedBabaYaga({
  headless: false,
  screenshotPath: './screenshots'
});

await babayaga.start();

// The MCP client can now call tools like:
// - babayaga.navigate({ url: "https://example.com" })
// - babayaga.screenshot({ fullPage: true })
// - babayaga.click({ selector: "#submit" })
```

## Conclusion

This unified architecture provides a clean, maintainable, and extensible foundation for BabaYaga. By following MCP best practices and eliminating unnecessary complexity, we create a robust browser automation platform that's easy to use and develop.