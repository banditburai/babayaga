import { ToolResponse } from '../../types/mcp';

export interface StreamingContext {
  isLargeResponse: boolean;
  sizeInBytes?: number;
  contentType?: string;
}

export class StreamingResponseHandler {
  private readonly LARGE_RESPONSE_THRESHOLD = 1024 * 1024; // 1MB
  private readonly CHUNK_SIZE = 64 * 1024; // 64KB chunks
  
  isLargeResponse(content: any): StreamingContext {
    let sizeInBytes = 0;
    let contentType = 'unknown';
    
    if (typeof content === 'string') {
      sizeInBytes = Buffer.byteLength(content);
      contentType = 'text';
    } else if (Buffer.isBuffer(content)) {
      sizeInBytes = content.length;
      contentType = 'binary';
    } else if (typeof content === 'object') {
      const jsonString = JSON.stringify(content);
      sizeInBytes = Buffer.byteLength(jsonString);
      contentType = 'json';
    }
    
    return {
      isLargeResponse: sizeInBytes > this.LARGE_RESPONSE_THRESHOLD,
      sizeInBytes,
      contentType,
    };
  }
  
  async createStreamingResponse(content: any, context: StreamingContext): Promise<ToolResponse> {
    if (!context.isLargeResponse) {
      // Return normal response for small content
      return {
        content: [{
          type: 'text',
          text: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
        }],
      };
    }
    
    // For large responses, save to file and return reference
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `large-response-${timestamp}.${context.contentType === 'json' ? 'json' : 'txt'}`;
    const filepath = `./cdp-output/${filename}`;
    
    // Save content to file
    const fs = await import('fs/promises');
    await fs.mkdir('./cdp-output', { recursive: true });
    
    if (typeof content === 'string' || Buffer.isBuffer(content)) {
      await fs.writeFile(filepath, content);
    } else {
      await fs.writeFile(filepath, JSON.stringify(content, null, 2));
    }
    
    // Return reference with metadata
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          type: 'large_response',
          filepath,
          filename,
          sizeInBytes: context.sizeInBytes,
          contentType: context.contentType,
          message: `Large response saved to ${filepath}`,
          preview: this.getPreview(content),
        }, null, 2),
      }],
    };
  }
  
  private getPreview(content: any): string {
    const maxPreviewLength = 200;
    let preview = '';
    
    if (typeof content === 'string') {
      preview = content.substring(0, maxPreviewLength);
      if (content.length > maxPreviewLength) {
        preview += '...';
      }
    } else if (typeof content === 'object') {
      const jsonString = JSON.stringify(content, null, 2);
      preview = jsonString.substring(0, maxPreviewLength);
      if (jsonString.length > maxPreviewLength) {
        preview += '...';
      }
    }
    
    return preview;
  }
  
  // Create a streaming tool response for real-time data
  createStreamGenerator(dataSource: AsyncIterable<any>): AsyncGenerator<ToolResponse> {
    const chunkSize = this.CHUNK_SIZE;
    return (async function* () {
      let buffer = '';
      let chunkCount = 0;
      
      for await (const chunk of dataSource) {
        chunkCount++;
        const chunkData = typeof chunk === 'string' ? chunk : JSON.stringify(chunk);
        buffer += chunkData;
        
        // Yield chunks periodically
        if (buffer.length >= chunkSize || chunkCount % 10 === 0) {
          yield {
            content: [{
              type: 'text',
              text: buffer,
              metadata: {
                streaming: true,
                chunkNumber: chunkCount,
              },
            }],
          };
          buffer = '';
        }
      }
      
      // Yield any remaining data
      if (buffer.length > 0) {
        yield {
          content: [{
            type: 'text',
            text: buffer,
            metadata: {
              streaming: true,
              chunkNumber: chunkCount + 1,
              final: true,
            },
          }],
        };
      }
    })();
  }
}

// Example usage for streaming CDP events
export class CDPEventStreamer {
  
  async *streamCDPEvents(cdpClient: any, eventNames: string[]): AsyncGenerator<ToolResponse> {
    const events: any[] = [];
    const listeners = new Map<string, (params: any) => void>();
    
    // Set up listeners for requested events
    for (const eventName of eventNames) {
      const listener = (params: any) => {
        events.push({
          event: eventName,
          timestamp: new Date().toISOString(),
          params,
        });
      };
      
      cdpClient.on(eventName, listener);
      listeners.set(eventName, listener);
    }
    
    // Stream events periodically
    const streamDuration = 30000; // 30 seconds max
    const streamInterval = 1000; // Send updates every second
    const startTime = Date.now();
    
    while (Date.now() - startTime < streamDuration) {
      await new Promise(resolve => setTimeout(resolve, streamInterval));
      
      if (events.length > 0) {
        const eventsToSend = [...events];
        events.length = 0; // Clear the array
        
        yield {
          content: [{
            type: 'text',
            text: JSON.stringify({
              type: 'cdp_event_stream',
              events: eventsToSend,
              totalEvents: eventsToSend.length,
              streamTime: Date.now() - startTime,
            }, null, 2),
          }],
        };
      }
    }
    
    // Clean up listeners
    for (const [eventName, listener] of listeners) {
      cdpClient.off(eventName, listener);
    }
    
    // Send final summary
    yield {
      content: [{
        type: 'text',
        text: JSON.stringify({
          type: 'cdp_event_stream',
          summary: {
            duration: Date.now() - startTime,
            eventsMonitored: eventNames,
            message: 'Stream completed',
          },
        }, null, 2),
      }],
    };
  }
}