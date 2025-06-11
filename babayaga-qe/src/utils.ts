import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { ToolResponse, DEFAULT_OUTPUT_DIR } from './types.js';

export interface BinaryDataOptions {
  outputDir?: string;
  binaryFields?: string[];
  minBinarySize?: number;
  saveFiles?: boolean;
}

const DEFAULT_BINARY_FIELDS = ['data', 'content', 'body', 'screenshot', 'buffer'];
const DEFAULT_MIN_BINARY_SIZE = 1000;

export async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

export function isBase64(str: string): boolean {
  if (typeof str !== 'string' || str.length === 0) {
    return false;
  }
  
  // Remove whitespace
  const cleaned = str.replace(/\s/g, '');
  
  // Check length is multiple of 4
  if (cleaned.length % 4 !== 0) {
    return false;
  }
  
  // Check valid base64 characters
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  return base64Regex.test(cleaned);
}

export function detectFileType(data: string): string {
  // Common file signatures
  const signatures: Record<string, string> = {
    'iVBORw0KGgo': '.png',
    '/9j/': '.jpg',
    'JVBERi0': '.pdf',
    'UEsDBBQ': '.zip',
    'GIF87a': '.gif',
    'GIF89a': '.gif',
    'Qk0': '.bmp',
    'SUkqAA': '.tiff',
    'TU0AK': '.tiff',
  };
  
  for (const [signature, extension] of Object.entries(signatures)) {
    if (data.startsWith(signature)) {
      return extension;
    }
  }
  
  return '.bin';
}

export async function saveBinaryData(
  data: string,
  fieldName: string,
  outputDir: string
): Promise<string> {
  await ensureDir(outputDir);
  
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  const extension = detectFileType(data);
  const fileName = `${fieldName}_${timestamp}_${random}${extension}`;
  const filePath = path.join(outputDir, fileName);
  
  try {
    const buffer = Buffer.from(data, 'base64');
    await fs.writeFile(filePath, buffer);
    return filePath;
  } catch (error) {
    throw new Error(`Failed to save binary data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function processCDPResponse(
  response: any,
  options: BinaryDataOptions = {}
): Promise<any> {
  const {
    outputDir = DEFAULT_OUTPUT_DIR,
    binaryFields = DEFAULT_BINARY_FIELDS,
    minBinarySize = DEFAULT_MIN_BINARY_SIZE,
    saveFiles = true,
  } = options;

  const processValue = async (obj: any, currentPath: string[] = []): Promise<any> => {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return Promise.all(obj.map((item, index) => 
        processValue(item, [...currentPath, String(index)])
      ));
    }

    if (typeof obj === 'object') {
      const processed: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        const fieldPath = [...currentPath, key];
        
        // Check if this field should be processed as binary
        if (
          typeof value === 'string' &&
          binaryFields.includes(key) &&
          value.length > minBinarySize &&
          isBase64(value)
        ) {
          if (saveFiles) {
            try {
              const filePath = await saveBinaryData(value, key, outputDir);
              processed[key] = {
                type: 'file',
                path: filePath,
                size: Buffer.from(value, 'base64').length,
                fieldPath: fieldPath.join('.'),
              };
            } catch (error) {
              processed[key] = {
                type: 'error',
                message: `Failed to save binary data: ${error instanceof Error ? error.message : String(error)}`,
                fieldPath: fieldPath.join('.'),
              };
            }
          } else {
            processed[key] = {
              type: 'base64',
              length: value.length,
              truncated: true,
              preview: value.substring(0, 100) + '...',
              fieldPath: fieldPath.join('.'),
            };
          }
        } else {
          processed[key] = await processValue(value, fieldPath);
        }
      }
      
      return processed;
    }

    return obj;
  };

  return processValue(response);
}

// Custom Error Classes
export class CDPCommandError extends Error {
  constructor(
    message: string,
    public readonly method: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'CDPCommandError';
  }
}

export class CDPConnectionError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'CDPConnectionError';
  }
}

// Utility Functions
export function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function formatJsonResponse(data: unknown): ToolResponse {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function formatCDPError(error: any): string {
  if (error?.error) {
    return `CDP Error ${error.error.code}: ${error.error.message}${
      error.error.data ? `\nData: ${JSON.stringify(error.error.data, null, 2)}` : ''
    }`;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return String(error);
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}