import { ToolResponse } from '../../../types/mcp';

export interface TransformContext {
  toolName: string;
  serviceName?: string;
  originalResponse: any;
  metadata?: Record<string, any>;
}

export abstract class ResponseTransformer {
  abstract name: string;
  abstract description: string;
  
  abstract canTransform(context: TransformContext): boolean;
  abstract transform(context: TransformContext): Promise<ToolResponse>;
  
  protected createResponse(content: any): ToolResponse {
    if (typeof content === 'string') {
      return {
        content: [{
          type: 'text',
          text: content,
        }],
      };
    }
    
    if (typeof content === 'object') {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(content, null, 2),
        }],
      };
    }
    
    return {
      content: [{
        type: 'text',
        text: String(content),
      }],
    };
  }
}

export class TransformerChain {
  private transformers: ResponseTransformer[] = [];
  
  add(transformer: ResponseTransformer): void {
    this.transformers.push(transformer);
  }
  
  async transform(context: TransformContext): Promise<ToolResponse> {
    for (const transformer of this.transformers) {
      if (transformer.canTransform(context)) {
        return await transformer.transform(context);
      }
    }
    
    // Default transformation
    return {
      content: [{
        type: 'text',
        text: typeof context.originalResponse === 'string' 
          ? context.originalResponse 
          : JSON.stringify(context.originalResponse, null, 2),
      }],
    };
  }
}