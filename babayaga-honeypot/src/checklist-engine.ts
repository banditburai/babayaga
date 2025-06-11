/**
 * Checklist Engine - JSON schema validation and checklist management
 * 
 * Handles loading, validation, and processing of test checklists
 * with comprehensive schema validation and dependency checking.
 */

import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import { logger, ValidationError } from '@babayaga/shared';
import {
  Checklist,
  ChecklistItem,
  ChecklistEngineConfig,
  ValidationResult,
  ValidationWarning,
  HoneypotError
} from './types.js';

// JSON Schema for checklist validation
const CHECKLIST_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    metadata: {
      type: "object",
      properties: {
        id: { type: "string", pattern: "^[a-zA-Z0-9_-]+$" },
        name: { type: "string", maxLength: 100 },
        version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" },
        description: { type: "string", maxLength: 500 },
        author: { type: "string", maxLength: 100 },
        created: { type: "string", format: "date-time" },
        updated: { type: "string", format: "date-time" },
        tags: { 
          type: "array", 
          items: { type: "string" },
          maxItems: 20
        },
        estimatedDuration: { type: "number", minimum: 0 }
      },
      required: ["id", "name", "version", "description"],
      additionalProperties: false
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", pattern: "^[a-zA-Z0-9_-]+$" },
          title: { type: "string", maxLength: 100 },
          description: { type: "string", maxLength: 500 },
          instructions: { type: "string" },
          expectedOutcome: { type: "string" },
          verificationCriteria: { 
            type: "array", 
            items: { type: "string" },
            minItems: 1,
            maxItems: 20
          },
          estimatedDuration: { type: "number", minimum: 0 },
          difficulty: { enum: ["easy", "medium", "hard"] },
          dependencies: { 
            type: "array", 
            items: { type: "string" },
            maxItems: 10
          },
          tags: { 
            type: "array", 
            items: { type: "string" },
            maxItems: 10
          },
          metadata: { type: "object" }
        },
        required: ["id", "title", "description", "instructions", "expectedOutcome", "verificationCriteria"],
        additionalProperties: false
      },
      minItems: 1,
      maxItems: 100
    }
  },
  required: ["metadata", "items"],
  additionalProperties: false
} as const;

export class ChecklistEngine {
  private config: Required<ChecklistEngineConfig>;
  private checklistCache = new Map<string, Checklist>();
  private validationCache = new Map<string, ValidationResult>();

  constructor(config: Partial<ChecklistEngineConfig> = {}) {
    this.config = {
      schemaValidationEnabled: true,
      dependencyValidationEnabled: true,
      templateSupport: false,
      cacheEnabled: true,
      ...config
    };
  }

  async initialize(): Promise<void> {
    try {
      logger.info('ChecklistEngine initialized', {
        schemaValidationEnabled: this.config.schemaValidationEnabled,
        dependencyValidationEnabled: this.config.dependencyValidationEnabled,
        templateSupport: this.config.templateSupport,
        cacheEnabled: this.config.cacheEnabled
      });
    } catch (error) {
      logger.error('Failed to initialize ChecklistEngine', {}, error as Error);
      throw new HoneypotError('ChecklistEngine initialization failed', 'INIT_ERROR', { error });
    }
  }

  // ============================================================================
  // CHECKLIST LOADING AND VALIDATION
  // ============================================================================

  async loadChecklist(path: string): Promise<Checklist> {
    try {
      // Check cache first
      if (this.config.cacheEnabled && this.checklistCache.has(path)) {
        const cached = this.checklistCache.get(path)!;
        logger.debug('Checklist loaded from cache', { path, id: cached.metadata.id });
        return cached;
      }

      // Load from file
      const content = await fs.readFile(path, 'utf8');
      const rawChecklist = JSON.parse(content);

      // Validate if enabled
      if (this.config.schemaValidationEnabled) {
        const validation = await this.validateChecklist(rawChecklist, path);
        if (!validation.valid) {
          throw new HoneypotError(
            `Checklist validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
            'VALIDATION_ERROR',
            { path, errors: validation.errors }
          );
        }
      }

      // Process and normalize
      const checklist = await this.processChecklist(rawChecklist, path);

      // Cache if enabled
      if (this.config.cacheEnabled) {
        this.checklistCache.set(path, checklist);
      }

      logger.info('Checklist loaded', {
        path,
        id: checklist.metadata.id,
        name: checklist.metadata.name,
        version: checklist.metadata.version,
        itemCount: checklist.items.length
      });

      return checklist;
    } catch (error) {
      logger.error('Failed to load checklist', { path }, error as Error);
      throw error instanceof HoneypotError ? error : new HoneypotError(
        `Failed to load checklist: ${(error as Error).message}`,
        'LOAD_ERROR',
        { path, originalError: error }
      );
    }
  }

  async validateChecklist(checklist: any, source?: string): Promise<ValidationResult> {
    try {
      const cacheKey = source ? `${source}:${JSON.stringify(checklist).slice(0, 100)}` : JSON.stringify(checklist);
      
      // Check validation cache
      if (this.config.cacheEnabled && this.validationCache.has(cacheKey)) {
        return this.validationCache.get(cacheKey)!;
      }

      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      // Schema validation
      if (this.config.schemaValidationEnabled) {
        const schemaErrors = this.validateAgainstSchema(checklist);
        errors.push(...schemaErrors);
      }

      // Dependency validation
      if (this.config.dependencyValidationEnabled && checklist.items) {
        const dependencyErrors = this.validateDependencies(checklist.items);
        errors.push(...dependencyErrors);
      }

      // Business logic validation
      const businessValidation = this.validateBusinessLogic(checklist);
      errors.push(...businessValidation.errors);
      warnings.push(...businessValidation.warnings);

      const result: ValidationResult = {
        valid: errors.length === 0,
        errors,
        warnings,
        metadata: {
          validatedAt: new Date().toISOString(),
          schemaVersion: '1.0.0',
          checklistVersion: checklist.metadata?.version || 'unknown',
          validatorVersion: '1.0.0'
        }
      };

      // Cache result
      if (this.config.cacheEnabled) {
        this.validationCache.set(cacheKey, result);
      }

      logger.debug('Checklist validation completed', {
        source,
        valid: result.valid,
        errorCount: errors.length,
        warningCount: warnings.length
      });

      return result;
    } catch (error) {
      logger.error('Checklist validation failed', { source }, error as Error);
      throw new HoneypotError(
        `Checklist validation failed: ${(error as Error).message}`,
        'VALIDATION_ERROR',
        { source, originalError: error }
      );
    }
  }

  // ============================================================================
  // SCHEMA VALIDATION
  // ============================================================================

  private validateAgainstSchema(checklist: any): ValidationError[] {
    const errors: ValidationError[] = [];

    try {
      // Simple schema validation (could be replaced with ajv or similar)
      this.validateObject(checklist, CHECKLIST_SCHEMA, '', errors);
    } catch (error) {
      errors.push({
        name: 'ValidationError',
        field: 'root',
        message: `Schema validation error: ${(error as Error).message}`,
        code: 'SCHEMA_ERROR'
      });
    }

    return errors;
  }

  private validateObject(obj: any, schema: any, path: string, errors: ValidationError[]): void {
    if (schema.type === 'object') {
      if (typeof obj !== 'object' || obj === null) {
        errors.push({
          name: 'ValidationError',
          field: path,
          message: `Expected object, got ${typeof obj}`,
          value: obj,
          code: 'TYPE_ERROR'
        });
        return;
      }

      // Check required properties
      if (schema.required) {
        for (const prop of schema.required) {
          if (!(prop in obj)) {
            errors.push({
              name: 'ValidationError',
              field: `${path}.${prop}`,
              message: `Required property '${prop}' is missing`,
              code: 'REQUIRED_ERROR'
            });
          }
        }
      }

      // Validate properties
      if (schema.properties) {
        for (const [prop, propSchema] of Object.entries(schema.properties)) {
          if (prop in obj) {
            this.validateObject(obj[prop], propSchema, path ? `${path}.${prop}` : prop, errors);
          }
        }
      }

      // Check additional properties
      if (schema.additionalProperties === false) {
        const allowedProps = Object.keys(schema.properties || {});
        for (const prop of Object.keys(obj)) {
          if (!allowedProps.includes(prop)) {
            errors.push({
              name: 'ValidationError',
              field: `${path}.${prop}`,
              message: `Additional property '${prop}' is not allowed`,
              code: 'ADDITIONAL_PROPERTY_ERROR'
            });
          }
        }
      }
    } else if (schema.type === 'array') {
      if (!Array.isArray(obj)) {
        errors.push({
          name: 'ValidationError',
          field: path,
          message: `Expected array, got ${typeof obj}`,
          value: obj,
          code: 'TYPE_ERROR'
        });
        return;
      }

      // Check array constraints
      if (schema.minItems && obj.length < schema.minItems) {
        errors.push({
          name: 'ValidationError',
          field: path,
          message: `Array must have at least ${schema.minItems} items, got ${obj.length}`,
          value: obj.length,
          code: 'MIN_ITEMS_ERROR'
        });
      }

      if (schema.maxItems && obj.length > schema.maxItems) {
        errors.push({
          name: 'ValidationError',
          field: path,
          message: `Array must have at most ${schema.maxItems} items, got ${obj.length}`,
          value: obj.length,
          code: 'MAX_ITEMS_ERROR'
        });
      }

      // Validate array items
      if (schema.items) {
        obj.forEach((item: any, index: number) => {
          this.validateObject(item, schema.items, `${path}[${index}]`, errors);
        });
      }
    } else if (schema.type === 'string') {
      if (typeof obj !== 'string') {
        errors.push({
          name: 'ValidationError',
          field: path,
          message: `Expected string, got ${typeof obj}`,
          value: obj,
          code: 'TYPE_ERROR'
        });
        return;
      }

      // Check string constraints
      if (schema.maxLength && obj.length > schema.maxLength) {
        errors.push({
          name: 'ValidationError',
          field: path,
          message: `String must be at most ${schema.maxLength} characters, got ${obj.length}`,
          value: obj.length,
          code: 'MAX_LENGTH_ERROR'
        });
      }

      if (schema.pattern && !new RegExp(schema.pattern).test(obj)) {
        errors.push({
          name: 'ValidationError',
          field: path,
          message: `String does not match pattern ${schema.pattern}`,
          value: obj,
          code: 'PATTERN_ERROR'
        });
      }

      if (schema.enum && !schema.enum.includes(obj)) {
        errors.push({
          name: 'ValidationError',
          field: path,
          message: `Value must be one of: ${schema.enum.join(', ')}`,
          value: obj,
          code: 'ENUM_ERROR'
        });
      }
    } else if (schema.type === 'number') {
      if (typeof obj !== 'number') {
        errors.push({
          name: 'ValidationError',
          field: path,
          message: `Expected number, got ${typeof obj}`,
          value: obj,
          code: 'TYPE_ERROR'
        });
        return;
      }

      // Check number constraints
      if (schema.minimum !== undefined && obj < schema.minimum) {
        errors.push({
          name: 'ValidationError',
          field: path,
          message: `Number must be at least ${schema.minimum}, got ${obj}`,
          value: obj,
          code: 'MINIMUM_ERROR'
        });
      }
    }
  }

  // ============================================================================
  // DEPENDENCY VALIDATION
  // ============================================================================

  private validateDependencies(items: ChecklistItem[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const itemIds = new Set(items.map(item => item.id));

    // Check for duplicate IDs
    const seenIds = new Set<string>();
    for (const item of items) {
      if (seenIds.has(item.id)) {
        errors.push({
          name: 'ValidationError',
          field: `items[${items.indexOf(item)}].id`,
          message: `Duplicate item ID: ${item.id}`,
          value: item.id,
          code: 'DUPLICATE_ID_ERROR'
        });
      }
      seenIds.add(item.id);
    }

    // Validate dependencies
    for (const item of items) {
      if (item.dependencies) {
        for (const depId of item.dependencies) {
          if (!itemIds.has(depId)) {
            errors.push({
              name: 'ValidationError',
              field: `items[${items.indexOf(item)}].dependencies`,
              message: `Dependency '${depId}' not found in checklist`,
              value: depId,
              code: 'MISSING_DEPENDENCY_ERROR'
            });
          }
        }
      }
    }

    // Check for circular dependencies
    const circularDeps = this.detectCircularDependencies(items);
    for (const cycle of circularDeps) {
      errors.push({
        name: 'ValidationError',
        field: 'items.dependencies',
        message: `Circular dependency detected: ${cycle.join(' -> ')}`,
        value: cycle,
        code: 'CIRCULAR_DEPENDENCY_ERROR'
      });
    }

    return errors;
  }

  private detectCircularDependencies(items: ChecklistItem[]): string[][] {
    const cycles: string[][] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const dependencyMap = new Map<string, string[]>();

    // Build dependency map
    for (const item of items) {
      dependencyMap.set(item.id, item.dependencies || []);
    }

    const visit = (itemId: string, path: string[]): void => {
      if (visiting.has(itemId)) {
        // Found a cycle
        const cycleStart = path.indexOf(itemId);
        if (cycleStart >= 0) {
          cycles.push([...path.slice(cycleStart), itemId]);
        }
        return;
      }

      if (visited.has(itemId)) {
        return;
      }

      visiting.add(itemId);
      const dependencies = dependencyMap.get(itemId) || [];
      
      for (const depId of dependencies) {
        visit(depId, [...path, itemId]);
      }

      visiting.delete(itemId);
      visited.add(itemId);
    };

    for (const item of items) {
      if (!visited.has(item.id)) {
        visit(item.id, []);
      }
    }

    return cycles;
  }

  // ============================================================================
  // BUSINESS LOGIC VALIDATION
  // ============================================================================

  private validateBusinessLogic(checklist: any): { errors: ValidationError[], warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Validate metadata
      if (checklist.metadata) {
        // Check version format
        if (checklist.metadata.version && !/^\d+\.\d+\.\d+$/.test(checklist.metadata.version)) {
          warnings.push({
            field: 'metadata.version',
            message: 'Version should follow semantic versioning (x.y.z)',
            recommendation: 'Use format like "1.0.0"'
          });
        }

        // Check estimated duration reasonableness
        if (checklist.metadata.estimatedDuration && checklist.metadata.estimatedDuration > 24 * 60 * 60 * 1000) {
          warnings.push({
            field: 'metadata.estimatedDuration',
            message: 'Estimated duration exceeds 24 hours',
            recommendation: 'Consider breaking into smaller checklists'
          });
        }
      }

      // Validate items
      if (checklist.items) {
        let totalEstimatedDuration = 0;

        for (let i = 0; i < checklist.items.length; i++) {
          const item = checklist.items[i];
          const itemPath = `items[${i}]`;

          // Check item duration
          if (item.estimatedDuration) {
            totalEstimatedDuration += item.estimatedDuration;
            
            if (item.estimatedDuration > 60 * 60 * 1000) { // 1 hour
              warnings.push({
                field: `${itemPath}.estimatedDuration`,
                message: 'Item duration exceeds 1 hour',
                recommendation: 'Consider breaking into smaller test items'
              });
            }
          }

          // Check verification criteria count
          if (item.verificationCriteria && item.verificationCriteria.length > 10) {
            warnings.push({
              field: `${itemPath}.verificationCriteria`,
              message: 'Too many verification criteria',
              recommendation: 'Consider consolidating criteria or splitting the test'
            });
          }

          // Check for overly complex dependencies
          if (item.dependencies && item.dependencies.length > 5) {
            warnings.push({
              field: `${itemPath}.dependencies`,
              message: 'Too many dependencies',
              recommendation: 'Consider restructuring test dependencies'
            });
          }
        }

        // Check total duration vs metadata
        if (checklist.metadata?.estimatedDuration && totalEstimatedDuration > 0) {
          const variance = Math.abs(checklist.metadata.estimatedDuration - totalEstimatedDuration);
          if (variance > checklist.metadata.estimatedDuration * 0.2) { // 20% variance
            warnings.push({
              field: 'metadata.estimatedDuration',
              message: 'Metadata duration differs significantly from sum of item durations',
              recommendation: 'Ensure duration estimates are consistent'
            });
          }
        }
      }
    } catch (error) {
      errors.push({
        name: 'ValidationError',
        field: 'businessLogic',
        message: `Business logic validation error: ${(error as Error).message}`,
        code: 'BUSINESS_LOGIC_ERROR'
      });
    }

    return { errors, warnings };
  }

  // ============================================================================
  // CHECKLIST PROCESSING
  // ============================================================================

  private async processChecklist(rawChecklist: any, source: string): Promise<Checklist> {
    try {
      // Normalize and enrich the checklist
      const checklist: Checklist = {
        metadata: {
          ...rawChecklist.metadata,
          // Ensure required metadata is present
          created: rawChecklist.metadata.created || new Date().toISOString(),
          updated: new Date().toISOString(),
          tags: rawChecklist.metadata.tags || []
        },
        items: rawChecklist.items.map((item: any, index: number) => ({
          ...item,
          // Ensure required fields have defaults
          tags: item.tags || [],
          dependencies: item.dependencies || [],
          metadata: {
            ...item.metadata,
            sourceIndex: index,
            sourceFile: basename(source)
          }
        }))
      };

      // Calculate total estimated duration if not provided
      if (!checklist.metadata.estimatedDuration) {
        const totalDuration = checklist.items.reduce((sum, item) => 
          sum + (item.estimatedDuration || 0), 0);
        if (totalDuration > 0) {
          checklist.metadata.estimatedDuration = totalDuration;
        }
      }

      return checklist;
    } catch (error) {
      throw new HoneypotError(
        `Failed to process checklist: ${(error as Error).message}`,
        'PROCESSING_ERROR',
        { source, originalError: error }
      );
    }
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  clearCache(): void {
    this.checklistCache.clear();
    this.validationCache.clear();
    logger.debug('ChecklistEngine cache cleared');
  }

  getCacheStats() {
    return {
      checklistCacheSize: this.checklistCache.size,
      validationCacheSize: this.validationCache.size,
      cacheEnabled: this.config.cacheEnabled
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  async checkChecklistExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  getChecklistSummary(checklist: Checklist) {
    const summary = {
      id: checklist.metadata.id,
      name: checklist.metadata.name,
      version: checklist.metadata.version,
      itemCount: checklist.items.length,
      estimatedDuration: checklist.metadata.estimatedDuration,
      difficulties: {
        easy: checklist.items.filter(item => item.difficulty === 'easy').length,
        medium: checklist.items.filter(item => item.difficulty === 'medium').length,
        hard: checklist.items.filter(item => item.difficulty === 'hard').length,
        unspecified: checklist.items.filter(item => !item.difficulty).length
      },
      tags: Array.from(new Set(checklist.items.flatMap(item => item.tags || []))),
      hasDependencies: checklist.items.some(item => item.dependencies && item.dependencies.length > 0)
    };

    return summary;
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  async cleanup(): Promise<void> {
    try {
      this.clearCache();
      logger.info('ChecklistEngine cleanup completed');
    } catch (error) {
      logger.error('ChecklistEngine cleanup failed', {}, error as Error);
    }
  }

  getMetrics() {
    return {
      ...this.getCacheStats(),
      schemaValidationEnabled: this.config.schemaValidationEnabled,
      dependencyValidationEnabled: this.config.dependencyValidationEnabled,
      templateSupport: this.config.templateSupport
    };
  }
}