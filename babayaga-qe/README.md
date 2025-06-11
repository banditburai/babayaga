# Babayaga-QE

A comprehensive frontend QA measurement toolkit built on Chrome DevTools Protocol (CDP) and Model Context Protocol (MCP).

## Features

- **Element Measurement**: Precise dimensions, box model, typography, and visibility analysis
- **Distance Calculations**: Spatial relationships and alignment detection between elements
- **Layout Grid Analysis**: Automated grid detection and spacing consistency validation
- **Robust Connection Management**: Automatic reconnection with configurable retry logic
- **Type Safety**: Full TypeScript support with Zod validation
- **Comprehensive Testing**: Unit, integration, and performance test suites

## Core Tools

- `qa_measure_element`: Comprehensive element analysis with box model, typography, and visibility
- `qa_measure_distances`: Calculate distances and spatial relationships between elements  
- `qa_analyze_layout_grid`: Analyze grid layouts for spacing consistency and alignment
- `cdp_health_check`: Monitor CDP connection and system health
- `cdp_sync_playwright`: Synchronize CDP with Playwright browser instances

## Installation

```bash
npm install
```

## Usage

1. Start Chrome with debugging enabled:
```bash
google-chrome --remote-debugging-port=9222
```

2. Start the MCP server:
```bash
npm start
```

3. Configure in Claude:
```bash
claude mcp add cdp-server "npm start"
```

## Environment Variables

- `CDP_URL`: Chrome DevTools URL (default: `http://localhost:9222/json`)

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Type checking
npm run typecheck

# Build
npm run build
```

## Documentation

- **[Quick Reference](QUICK_REFERENCE.md)** - Developer cheat sheet for common operations
- **[API Documentation](docs/api/TOOL_USAGE_DOCUMENTATION.md)** - Complete tool reference with examples
- **[Troubleshooting Guide](docs/api/TROUBLESHOOTING_GUIDE.md)** - Common issues and solutions

### Testing Documentation
- **[Testing Plan](docs/testing/TESTING_PLAN.md)** - Comprehensive test checklist
- **[Test Results](docs/testing/FINAL_SUMMARY_REPORT.md)** - Latest testing summary
- **[Performance Report](docs/testing/PERFORMANCE_REPORT.md)** - Performance benchmarks
- **[Edge Cases](docs/testing/EDGE_CASE_FINDINGS.md)** - Known limitations and edge cases

### Planning Documentation  
- **[Roadmap](docs/planning/FRONTEND_MEASUREMENT_ROADMAP.md)** - Long-term development plan
- **[Recommended Tools](docs/planning/RECOMMENDED_TOOLS_CHECKLIST.md)** - Future feature suggestions
- **[Top Priorities](docs/planning/TOP_5_PRIORITY_TOOLS.md)** - Next development priorities

## Repository Structure

```
babayaga-qe/
├── src/                    # Source code
├── docs/                   # Documentation
│   ├── api/               # API docs & troubleshooting
│   ├── testing/           # Test results & reports
│   └── planning/          # Roadmaps & priorities
├── tests/                 # Test suites
│   ├── fixtures/html/     # Test HTML pages
│   ├── performance/       # Performance tests
│   └── utils/            # Test utilities
└── dist/                 # Build output
```

## Architecture

- **CDPClient**: Handles WebSocket connection to Chrome DevTools
- **QA Measurement Tools**: Element analysis, distance calculation, grid detection
- **Health Monitoring**: CDP connection and system resource monitoring
- **Type Safety**: Full TypeScript support with Zod validation
- **MCP Integration**: Model Context Protocol server implementation