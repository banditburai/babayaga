import { Tool } from '../types/index.js';

export const browserTools: Tool[] = [
  {
    name: 'navigate',
    description: 'Navigate to a URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: { 
          type: 'string', 
          description: 'URL to navigate to' 
        },
        waitUntil: {
          type: 'string',
          enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
          description: 'When to consider navigation finished',
          default: 'networkidle2'
        }
      },
      required: ['url']
    },
    handler: async (args, { page }) => {
      await page.goto(args.url, { 
        waitUntil: args.waitUntil || 'networkidle2' 
      });
      return { 
        success: true, 
        url: page.url(),
        title: await page.title()
      };
    }
  },

  {
    name: 'click',
    description: 'Click an element on the page',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { 
          type: 'string', 
          description: 'CSS selector to click' 
        },
        clickCount: {
          type: 'number',
          description: 'Number of clicks',
          default: 1
        }
      },
      required: ['selector']
    },
    handler: async (args, { page }) => {
      await page.click(args.selector, {
        clickCount: args.clickCount || 1
      });
      return { 
        success: true, 
        clicked: args.selector 
      };
    }
  },

  {
    name: 'type',
    description: 'Type text into an input field',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { 
          type: 'string', 
          description: 'CSS selector of input field' 
        },
        text: { 
          type: 'string', 
          description: 'Text to type' 
        },
        clear: { 
          type: 'boolean', 
          description: 'Clear field before typing',
          default: false
        },
        delay: {
          type: 'number',
          description: 'Delay between key presses in ms',
          default: 0
        }
      },
      required: ['selector', 'text']
    },
    handler: async (args, { page }) => {
      if (args.clear) {
        await page.click(args.selector, { clickCount: 3 });
        await page.keyboard.press('Backspace');
      }
      
      await page.type(args.selector, args.text, {
        delay: args.delay || 0
      });
      
      return { 
        success: true, 
        typed: args.text,
        selector: args.selector
      };
    }
  },

  {
    name: 'wait',
    description: 'Wait for various conditions',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { 
          type: 'string', 
          description: 'CSS selector to wait for' 
        },
        timeout: { 
          type: 'number', 
          description: 'Maximum wait time in milliseconds',
          default: 30000
        },
        visible: { 
          type: 'boolean', 
          description: 'Wait for element to be visible',
          default: false
        },
        hidden: {
          type: 'boolean',
          description: 'Wait for element to be hidden',
          default: false
        }
      }
    },
    handler: async (args, { page }) => {
      if (args.selector) {
        const options: any = { 
          timeout: args.timeout || 30000 
        };
        
        if (args.visible) options.visible = true;
        if (args.hidden) options.hidden = true;
        
        await page.waitForSelector(args.selector, options);
        return { 
          success: true, 
          found: args.selector 
        };
      }
      
      if (args.timeout) {
        await new Promise(resolve => setTimeout(resolve, args.timeout));
        return { 
          success: true, 
          waited: args.timeout 
        };
      }
      
      throw new Error('Must specify either selector or timeout');
    }
  },

  {
    name: 'evaluate',
    description: 'Execute JavaScript in the page context',
    inputSchema: {
      type: 'object',
      properties: {
        code: { 
          type: 'string', 
          description: 'JavaScript code to execute' 
        }
      },
      required: ['code']
    },
    handler: async (args, { page }) => {
      const result = await page.evaluate(args.code);
      return { result };
    }
  },

  {
    name: 'page_info',
    description: 'Get information about the current page',
    inputSchema: {
      type: 'object',
      properties: {
        includeMetrics: {
          type: 'boolean',
          description: 'Include performance metrics',
          default: false
        }
      }
    },
    handler: async (args, { page }) => {
      const [title, url] = await Promise.all([
        page.title(),
        page.url()
      ]);
      
      const info: any = { title, url };
      
      if (args.includeMetrics) {
        info.metrics = await page.metrics();
      }
      
      return info;
    }
  },

  {
    name: 'go_back',
    description: 'Navigate back in browser history',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async (_, { page }) => {
      await page.goBack();
      return { 
        success: true,
        url: page.url()
      };
    }
  },

  {
    name: 'go_forward',
    description: 'Navigate forward in browser history',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async (_, { page }) => {
      await page.goForward();
      return { 
        success: true,
        url: page.url()
      };
    }
  },

  {
    name: 'reload',
    description: 'Reload the current page',
    inputSchema: {
      type: 'object',
      properties: {
        waitUntil: {
          type: 'string',
          enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
          description: 'When to consider reload finished',
          default: 'networkidle2'
        }
      }
    },
    handler: async (args, { page }) => {
      await page.reload({
        waitUntil: args.waitUntil || 'networkidle2'
      });
      return { 
        success: true,
        url: page.url()
      };
    }
  }
];