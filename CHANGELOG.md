# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-06-04

### Added
- Initial release of BabaYaga framework
- Puppeteer MCP server integration with 8 browser automation tools
- CDP MCP server implementation with 5 deep inspection tools
- Cross-platform Chrome automation support (macOS, Windows, Linux)
- Interactive test web application with console logging and style manipulation
- E2E testing framework with example scenarios
- TypeScript configuration with ES modules
- Comprehensive documentation suite
- Interactive setup wizard (`npm run setup`)
- Support for both team (project-scoped) and individual (user-scoped) installations
- `.mcp.json` example configuration for team sharing

### Features
- Dual MCP server architecture for high-level and low-level browser control
- Real-time console message streaming
- DOM element inspection and manipulation
- Screenshot capture capabilities
- JavaScript execution in browser context
- Computed style inspection
- Cross-platform Chrome/Chromium detection and launch
- Git submodule support for easy team integration

### Developer Experience
- Interactive setup wizard for easy configuration
- Single command startup (`npm start`)
- Built-in test suite (`npm run test:servers`, `npm run test:e2e`)
- TypeScript with full type safety
- Modern ES modules throughout
- Detailed installation guide with multiple setup methods
- Professional documentation and real-world examples