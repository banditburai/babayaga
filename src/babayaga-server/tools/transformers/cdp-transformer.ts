import { ResponseTransformer, TransformContext } from './base';
import { ToolResponse } from '../../../types/mcp';
import path from 'path';

export class CDPBinaryTransformer extends ResponseTransformer {
  name = 'cdp-binary-transformer';
  description = 'Transforms CDP binary responses (screenshots, PDFs) into file references';
  
  canTransform(context: TransformContext): boolean {
    return context.serviceName === 'cdp' && 
           context.originalResponse?.content?.[0]?.text?.includes('cdp-output/');
  }
  
  async transform(context: TransformContext): Promise<ToolResponse> {
    const response = context.originalResponse;
    const text = response.content[0].text;
    
    // Extract file path from response
    const filePathMatch = text.match(/saved to: (.*\.(?:png|pdf|jpg|jpeg|webp))/i);
    if (filePathMatch) {
      const filePath = filePathMatch[1];
      const fileName = path.basename(filePath);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            type: 'binary_file',
            path: filePath,
            filename: fileName,
            service: 'cdp',
            method: context.metadata?.method || 'unknown',
            message: `Binary output saved to ${filePath}`,
          }, null, 2),
        }],
      };
    }
    
    return response;
  }
}

export class CDPMetricsTransformer extends ResponseTransformer {
  name = 'cdp-metrics-transformer';
  description = 'Transforms CDP Performance.getMetrics into readable format';
  
  canTransform(context: TransformContext): boolean {
    return context.serviceName === 'cdp' && 
           context.metadata?.method === 'Performance.getMetrics';
  }
  
  async transform(context: TransformContext): Promise<ToolResponse> {
    try {
      const data = JSON.parse(context.originalResponse.content[0].text);
      const metrics = data.metrics || data;
      
      const formattedMetrics: Record<string, any> = {};
      
      // Group metrics by category
      const categories = {
        timing: ['DomContentLoaded', 'FirstPaint', 'FirstContentfulPaint', 'FirstMeaningfulPaint'],
        memory: ['JSHeapUsedSize', 'JSHeapTotalSize'],
        layout: ['LayoutCount', 'RecalcStyleCount', 'LayoutDuration', 'RecalcStyleDuration'],
        script: ['ScriptDuration', 'TaskDuration'],
      };
      
      for (const [category, metricNames] of Object.entries(categories)) {
        formattedMetrics[category] = {};
        for (const metricName of metricNames) {
          const metric = metrics.find((m: any) => m.name === metricName);
          if (metric) {
            formattedMetrics[category][metricName] = metric.value;
          }
        }
      }
      
      // Add any remaining metrics
      formattedMetrics.other = {};
      for (const metric of metrics) {
        const isKnown = Object.values(categories).flat().includes(metric.name);
        if (!isKnown) {
          formattedMetrics.other[metric.name] = metric.value;
        }
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(formattedMetrics, null, 2),
        }],
      };
    } catch (error) {
      return context.originalResponse;
    }
  }
}

export class CDPConsoleTransformer extends ResponseTransformer {
  name = 'cdp-console-transformer';
  description = 'Transforms CDP console messages into readable format';
  
  canTransform(context: TransformContext): boolean {
    return context.serviceName === 'cdp' && 
           (context.metadata?.method === 'Runtime.consoleAPICalled' ||
            context.toolName.includes('console'));
  }
  
  async transform(context: TransformContext): Promise<ToolResponse> {
    try {
      const data = JSON.parse(context.originalResponse.content[0].text);
      const messages = Array.isArray(data) ? data : [data];
      
      const formattedMessages = messages.map((msg: any) => ({
        level: msg.level || msg.type,
        text: msg.text || msg.args?.map((arg: any) => arg.value).join(' '),
        timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : undefined,
        source: msg.source,
        url: msg.url,
        line: msg.line,
      })).filter((msg: any) => msg.text);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            consoleMessages: formattedMessages,
            total: formattedMessages.length,
          }, null, 2),
        }],
      };
    } catch (error) {
      return context.originalResponse;
    }
  }
}