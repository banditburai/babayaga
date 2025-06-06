# BabaYaga Architecture Overview

## Unified Architecture

```mermaid
graph TB
    subgraph "Claude Desktop / MCP Client"
        A[Claude Agent]
        B[MCP Client]
    end
    
    subgraph "BabaYaga Unified Server"
        C[MCP Server<br/>stdio transport]
        D[Tool Registry]
        E[Browser Controller<br/>Puppeteer]
        
        subgraph "Tool Modules"
            F[Browser Tools]
            G[Visual Tools]
            H[Performance Tools]
        end
    end
    
    subgraph "Browser"
        I[Chrome/Chromium<br/>Controlled by Puppeteer]
        J[Web Page]
    end
    
    A --> B
    B -.stdio.-> C
    C --> D
    D --> F
    D --> G
    D --> H
    C --> E
    E --> I
    I --> J
    
    style A fill:#f9f9f9,stroke:#333,stroke-width:2px,color:#000
    style B fill:#e3f2fd,stroke:#1976d2,stroke-width:2px,color:#000
    style C fill:#e8f5e9,stroke:#4caf50,stroke-width:2px,color:#000
    style D fill:#fff3e0,stroke:#ff9800,stroke-width:2px,color:#000
    style E fill:#fce4ec,stroke:#e91e63,stroke-width:2px,color:#000
```

## Key Components

### 1. MCP Client (Claude Desktop)
- Connects to BabaYaga via stdio
- Sends tool requests
- Receives responses

### 2. BabaYaga Unified Server
- **Single Process**: Everything runs in one Node.js process
- **MCP Server**: Handles protocol communication
- **Tool Registry**: Manages available tools
- **Browser Controller**: Direct Puppeteer integration

### 3. Tool Modules
- **Browser Tools**: Navigation, clicking, typing, etc.
- **Visual Tools**: Screenshots with smart MCP token handling
- **Performance Tools**: Metrics and monitoring (planned)

### 4. Browser
- Controlled directly by Puppeteer
- No separate Chrome DevTools Protocol proxy
- Efficient, direct communication

## Data Flow

1. Claude sends a tool request via MCP
2. MCP Server receives and validates the request
3. Tool Registry finds the appropriate tool
4. Tool executes using Puppeteer
5. Response is formatted and sent back to Claude

## Benefits of Unified Architecture

- **Simplicity**: No IPC or subprocess management
- **Performance**: Direct control without proxy layers
- **Reliability**: Single process means fewer failure points
- **Debugging**: Standard Node.js debugging tools work
- **Type Safety**: Full TypeScript throughout