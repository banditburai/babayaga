import { Tool } from '../types/index.js';
import path from 'path';
import fs from 'fs/promises';

export const visualTools: Tool[] = [
  {
    name: 'screenshot',
    description: 'Take a screenshot of the current page',
    inputSchema: {
      type: 'object',
      properties: {
        fullPage: { 
          type: 'boolean', 
          description: 'Capture full page',
          default: false
        },
        selector: { 
          type: 'string', 
          description: 'CSS selector to capture (optional)' 
        },
        format: {
          type: 'string',
          enum: ['base64', 'binary'],
          description: 'Output format',
          default: 'base64'
        }
      }
    },
    handler: async (args, { page }) => {
      const options: any = {
        encoding: args.format === 'base64' ? 'base64' : 'binary'
      };
      
      if (args.fullPage) {
        options.fullPage = true;
      }
      
      let screenshot;
      if (args.selector) {
        const element = await page.$(args.selector);
        if (!element) {
          throw new Error(`Element not found: ${args.selector}`);
        }
        screenshot = await element.screenshot(options);
      } else {
        screenshot = await page.screenshot(options);
      }
      
      return {
        success: true,
        data: screenshot,
        format: args.format || 'base64'
      };
    }
  },

  {
    name: 'save_screenshot',
    description: 'Take a screenshot and save it to disk',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Filename for the screenshot (without extension)'
        },
        fullPage: { 
          type: 'boolean', 
          description: 'Capture full page',
          default: false
        },
        selector: { 
          type: 'string', 
          description: 'CSS selector to capture (optional)' 
        }
      },
      required: ['filename']
    },
    handler: async (args, { page, config }) => {
      const screenshotDir = config.screenshotPath || './screenshots';
      
      // Ensure directory exists
      await fs.mkdir(screenshotDir, { recursive: true });
      
      const filename = `${args.filename}.png`;
      const filepath = path.join(screenshotDir, filename);
      
      const options: any = {
        path: filepath
      };
      
      if (args.fullPage) {
        options.fullPage = true;
      }
      
      if (args.selector) {
        const element = await page.$(args.selector);
        if (!element) {
          throw new Error(`Element not found: ${args.selector}`);
        }
        await element.screenshot(options);
      } else {
        await page.screenshot(options);
      }
      
      return {
        success: true,
        path: filepath,
        filename: filename
      };
    }
  },

  {
    name: 'highlight',
    description: 'Highlight elements on the page',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector of elements to highlight'
        },
        color: {
          type: 'string',
          description: 'Highlight color',
          default: 'red'
        },
        duration: {
          type: 'number',
          description: 'Duration in milliseconds (0 for permanent)',
          default: 2000
        }
      },
      required: ['selector']
    },
    handler: async (args, { page }) => {
      const { selector, color = 'red', duration = 2000 } = args;
      
      // Inject highlight style
      await page.evaluate((sel, col) => {
        const elements = document.querySelectorAll(sel);
        elements.forEach((el: any) => {
          el.style.outline = `3px solid ${col}`;
          el.style.outlineOffset = '2px';
        });
        return elements.length;
      }, selector, color);
      
      // Remove highlight after duration if specified
      if (duration > 0) {
        setTimeout(async () => {
          await page.evaluate((sel) => {
            const elements = document.querySelectorAll(sel);
            elements.forEach((el: any) => {
              el.style.outline = '';
              el.style.outlineOffset = '';
            });
          }, selector);
        }, duration);
      }
      
      return {
        success: true,
        highlighted: selector,
        color: color,
        duration: duration
      };
    }
  },

  {
    name: 'get_element_info',
    description: 'Get detailed information about an element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector of the element'
        }
      },
      required: ['selector']
    },
    handler: async (args, { page }) => {
      const elementInfo = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        
        const rect = element.getBoundingClientRect();
        const computed = window.getComputedStyle(element);
        
        return {
          tagName: element.tagName.toLowerCase(),
          id: element.id || null,
          className: element.className || null,
          text: element.textContent?.trim() || null,
          visible: rect.width > 0 && rect.height > 0,
          position: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height
          },
          styles: {
            display: computed.display,
            visibility: computed.visibility,
            opacity: computed.opacity,
            color: computed.color,
            backgroundColor: computed.backgroundColor,
            fontSize: computed.fontSize
          }
        };
      }, args.selector);
      
      if (!elementInfo) {
        throw new Error(`Element not found: ${args.selector}`);
      }
      
      return elementInfo;
    }
  }
];