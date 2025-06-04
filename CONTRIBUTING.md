# Contributing to BabaYaga

So, you've braved the dark woods and found BabaYaga's hut on chicken legs! Don't worry, it mostly stays put while we're coding. Before you step inside and start tinkering with the magical (and sometimes cantankerous) workings of this project:

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on what is best for the community
- Show empathy towards other community members

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples**
- **Include your environment details** (OS, Node.js version, Chrome version)
- **Include any error messages or logs**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description of the proposed enhancement**
- **Explain why this enhancement would be useful**
- **List any alternative solutions you've considered**

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. Ensure the test suite passes (`npm run test:servers`)
4. Make sure your code follows the existing style
5. Issue that pull request!

## Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/banditburai/babayaga.git
   cd babayaga
   npm install
   ```

2. **Create a branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes and test:**
   ```bash
   npm run test:servers
   npm run test:e2e
   npx tsc --noEmit  # Type check
   ```

4. **Commit your changes:**
   ```bash
   git add .
   git commit -m "feat: add new CDP tool for network inspection"
   ```

## Commit Message Guidelines

We follow conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only changes
- `style:` - Code style changes (formatting, etc)
- `refactor:` - Code change that neither fixes a bug nor adds a feature
- `test:` - Adding missing tests
- `chore:` - Changes to the build process or auxiliary tools

## Adding New Tools

When adding new MCP tools:

1. **Update the appropriate server** (`src/cdp-mcp-server/` or Puppeteer integration)
2. **Add TypeScript types** for your tool parameters
3. **Update documentation:**
   - Add to README.md tools table
   - Create examples in docs/
4. **Add tests** in the test suite
5. **Update CHANGELOG.md**

### Example: Adding a new CDP tool

```typescript
// In src/cdp-mcp-server/index.ts

// 1. Add to tools array
{
  name: 'cdp_get_cookies',
  description: 'Get all cookies from the current page',
  inputSchema: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: 'Optional domain filter',
      },
    },
  },
},

// 2. Add handler in switch statement
case 'cdp_get_cookies':
  return await this.getCookies(toolArgs?.domain as string);

// 3. Implement the method
private async getCookies(domain?: string) {
  if (!this.activeClient) {
    throw new Error('Not connected to Chrome DevTools');
  }
  
  const { cookies } = await this.activeClient.send('Network.getCookies', {
    urls: domain ? [`https://${domain}`] : undefined,
  });
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(cookies, null, 2),
    }],
  };
}
```

## Testing

- **Unit tests** - Coming soon!
- **Integration tests** - Run `npm run test:servers`
- **E2E tests** - Run `npm run test:e2e`
- **Manual testing** - Test with Claude Code directly

## Documentation

- Keep README.md up to date
- Update relevant docs/ files
- Include JSDoc comments for new functions
- Add examples for new features

## Questions?

Feel free to open an issue with the "question" label or reach out to the maintainers.

## Recognition

Contributors will be recognized in:
- The project's README
- Release notes
- Our contributors page (coming soon)

Thank you for contributing to BabaYaga! 🔮