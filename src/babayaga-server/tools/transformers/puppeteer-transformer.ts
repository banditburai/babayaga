import { ResponseTransformer, TransformContext } from './base';
import { ToolResponse } from '../../../types/mcp';

export class PuppeteerScreenshotTransformer extends ResponseTransformer {
  name = 'puppeteer-screenshot-transformer';
  description = 'Transforms Puppeteer screenshot responses into standardized format';
  
  canTransform(context: TransformContext): boolean {
    return context.serviceName === 'puppeteer' && 
           context.toolName.includes('screenshot');
  }
  
  async transform(context: TransformContext): Promise<ToolResponse> {
    try {
      const response = context.originalResponse;
      const text = response.content[0].text;
      
      // Check if it's already a structured response
      if (text.includes('"path"') || text.includes('screenshot_path')) {
        const data = JSON.parse(text);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              type: 'screenshot',
              path: data.path || data.screenshot_path,
              service: 'puppeteer',
              timestamp: new Date().toISOString(),
              metadata: context.metadata,
            }, null, 2),
          }],
        };
      }
      
      // If it's a simple path response
      if (text.includes('.png') || text.includes('.jpg')) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              type: 'screenshot',
              path: text.trim(),
              service: 'puppeteer',
              timestamp: new Date().toISOString(),
            }, null, 2),
          }],
        };
      }
      
      return response;
    } catch (error) {
      return context.originalResponse;
    }
  }
}

export class PuppeteerNavigationTransformer extends ResponseTransformer {
  name = 'puppeteer-navigation-transformer';
  description = 'Transforms Puppeteer navigation responses';
  
  canTransform(context: TransformContext): boolean {
    return context.serviceName === 'puppeteer' && 
           context.toolName.includes('navigate');
  }
  
  async transform(context: TransformContext): Promise<ToolResponse> {
    try {
      const response = context.originalResponse;
      const text = response.content[0].text;
      
      // Parse response and add metadata
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            type: 'navigation',
            service: 'puppeteer',
            url: context.metadata?.url || data.url,
            status: data.status || 'success',
            timestamp: new Date().toISOString(),
            ...data,
          }, null, 2),
        }],
      };
    } catch (error) {
      return context.originalResponse;
    }
  }
}

export class PuppeteerEvaluateTransformer extends ResponseTransformer {
  name = 'puppeteer-evaluate-transformer';
  description = 'Transforms Puppeteer evaluate responses';
  
  canTransform(context: TransformContext): boolean {
    return context.serviceName === 'puppeteer' && 
           context.toolName.includes('evaluate');
  }
  
  async transform(context: TransformContext): Promise<ToolResponse> {
    try {
      const response = context.originalResponse;
      const text = response.content[0].text;
      
      let result: any;
      try {
        result = JSON.parse(text);
      } catch {
        result = text;
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            type: 'evaluation',
            service: 'puppeteer',
            result: result,
            script: context.metadata?.script?.substring(0, 100) + '...',
            timestamp: new Date().toISOString(),
          }, null, 2),
        }],
      };
    } catch (error) {
      return context.originalResponse;
    }
  }
}