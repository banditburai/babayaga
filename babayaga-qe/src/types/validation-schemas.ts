/**
 * Zod validation schemas for measurement tools
 */

import { z } from 'zod';

// Input schemas for measurement tools
export const MeasureElementDimensionsInputSchema = z.object({
  selector: z.string().describe('CSS selector for the element to measure'),
  includeTypography: z.boolean().optional().default(true).describe('Include typography measurements'),
  includeBoxModel: z.boolean().optional().default(true).describe('Include box model measurements'),
});

export const MeasureElementDistancesInputSchema = z.object({
  elementA: z.string().describe('CSS selector for the first element'),
  elementB: z.string().describe('CSS selector for the second element'),
});

export const AnalyzeLayoutGridInputSchema = z.object({
  elements: z.array(z.string()).describe('Array of CSS selectors for elements to analyze'),
  tolerancePixels: z.number().optional().default(2).describe('Pixel tolerance for alignment detection'),
});

export const BatchResponsiveAnalysisInputSchema = z.object({
  selector: z.string().describe('CSS selector for element to analyze'),
  viewports: z.array(z.object({
    width: z.number(),
    height: z.number(),
    deviceScaleFactor: z.number().optional(),
    isMobile: z.boolean().optional(),
    hasTouch: z.boolean().optional(),
  })).optional().describe('Array of viewports to test'),
  includeDefaultViewports: z.boolean().optional().default(true).describe('Include standard device viewports'),
});

export const DetectResponsiveBreakpointsInputSchema = z.object({
  element: z.string().describe('CSS selector for element to analyze'),
  minWidth: z.number().optional().default(320).describe('Minimum viewport width to test'),
  maxWidth: z.number().optional().default(1920).describe('Maximum viewport width to test'),
  stepSize: z.number().optional().default(10).describe('Width increment for breakpoint detection'),
});

export const ValidateResponsiveDesignInputSchema = z.object({
  viewport: z.object({
    width: z.number(),
    height: z.number(),
    deviceScaleFactor: z.number().optional(),
    isMobile: z.boolean().optional(),
    hasTouch: z.boolean().optional(),
  }).describe('Viewport configuration to validate'),
  elements: z.array(z.string()).optional().describe('Specific elements to validate'),
  checkTouchTargets: z.boolean().optional().default(true),
  checkTextReadability: z.boolean().optional().default(true),
  checkOverflow: z.boolean().optional().default(true),
});

export const VisualRegressionCompareInputSchema = z.object({
  baseline: z.string().describe('Baseline screenshot path or base64 string'),
  current: z.string().describe('Current screenshot path or base64 string'),
  threshold: z.number().optional().default(0.1).describe('Difference threshold (0-1)'),
  includeHighlightedDiff: z.boolean().optional().default(true),
});

export const CaptureDesignScreenshotsInputSchema = z.object({
  viewport: z.object({
    width: z.number(),
    height: z.number(),
  }).describe('Viewport configuration'),
  fullPage: z.boolean().optional().default(true),
  elements: z.array(z.string()).optional().describe('Specific elements to capture'),
  annotations: z.object({
    measurements: z.boolean().optional().default(false),
    gridOverlay: z.boolean().optional().default(false),
    spacingIndicators: z.boolean().optional().default(false),
  }).optional(),
});

export const AccessibilityMeasurementsInputSchema = z.object({
  element: z.string().describe('CSS selector for element to audit'),
  wcagLevel: z.enum(['A', 'AA', 'AAA']).optional().default('AA'),
  includeColorContrast: z.boolean().optional().default(true),
  includeFocusManagement: z.boolean().optional().default(true),
  includeSemantics: z.boolean().optional().default(true),
});

export const DesignSystemAuditInputSchema = z.object({
  designTokensUrl: z.string().optional().describe('URL or path to design tokens JSON'),
  components: z.array(z.string()).optional().describe('Specific components to audit'),
  strictMode: z.boolean().optional().default(false).describe('Fail on any deviation'),
});

export const AnalyzeVisualHierarchyInputSchema = z.object({
  viewport: z.object({
    width: z.number(),
    height: z.number(),
  }).optional(),
  elements: z.array(z.string()).optional().describe('Specific elements to include in analysis'),
  analyzeColorWeight: z.boolean().optional().default(true),
  analyzeSizeWeight: z.boolean().optional().default(true),
  analyzePositionWeight: z.boolean().optional().default(true),
});

export const PerformanceImpactAnalysisInputSchema = z.object({
  baseline: z.string().optional().describe('Baseline URL or state for comparison'),
  current: z.string().describe('Current URL or state to analyze'),
  metrics: z.array(z.enum(['renderTime', 'layoutShift', 'paintTime', 'memoryUsage'])).optional(),
});

// Type exports for use in implementation
export type MeasureElementDimensionsInput = z.infer<typeof MeasureElementDimensionsInputSchema>;
export type MeasureElementDistancesInput = z.infer<typeof MeasureElementDistancesInputSchema>;
export type AnalyzeLayoutGridInput = z.infer<typeof AnalyzeLayoutGridInputSchema>;
export type BatchResponsiveAnalysisInput = z.infer<typeof BatchResponsiveAnalysisInputSchema>;
export type DetectResponsiveBreakpointsInput = z.infer<typeof DetectResponsiveBreakpointsInputSchema>;
export type ValidateResponsiveDesignInput = z.infer<typeof ValidateResponsiveDesignInputSchema>;
export type VisualRegressionCompareInput = z.infer<typeof VisualRegressionCompareInputSchema>;
export type CaptureDesignScreenshotsInput = z.infer<typeof CaptureDesignScreenshotsInputSchema>;
export type AccessibilityMeasurementsInput = z.infer<typeof AccessibilityMeasurementsInputSchema>;
export type DesignSystemAuditInput = z.infer<typeof DesignSystemAuditInputSchema>;
export type AnalyzeVisualHierarchyInput = z.infer<typeof AnalyzeVisualHierarchyInputSchema>;
export type PerformanceImpactAnalysisInput = z.infer<typeof PerformanceImpactAnalysisInputSchema>;