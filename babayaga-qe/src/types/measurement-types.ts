/**
 * Measurement types for frontend design evaluation tools
 */

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ElementMeasurement {
  selector: string;
  dimensions: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
  boxModel: {
    content: BoundingBox;
    padding: BoundingBox;
    border: BoundingBox;
    margin: BoundingBox;
  };
  typography: {
    fontSize: string;
    lineHeight: string;
    fontFamily: string;
    fontWeight: string;
  };
  spacing: {
    marginTop: number;
    marginRight: number;
    marginBottom: number;
    marginLeft: number;
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
  };
  visibility: {
    isVisible: boolean;
    opacity: number;
    zIndex: string;
  };
}

export interface DistanceMeasurement {
  elementA: string;
  elementB: string;
  distances: {
    horizontal: number;
    vertical: number;
    diagonal: number;
    closestEdge: number;
  };
  relationship: 'above' | 'below' | 'left' | 'right' | 'overlapping';
  alignment: {
    horizontalAlignment: 'left' | 'center' | 'right' | 'none';
    verticalAlignment: 'top' | 'middle' | 'bottom' | 'none';
  };
}

export interface AlignmentIssue {
  elements: string[];
  type: 'horizontal' | 'vertical';
  expectedAlignment: number;
  actualAlignments: number[];
  deviation: number;
}

export interface SpacingInconsistency {
  type: 'horizontal' | 'vertical';
  locations: Array<{
    elements: [string, string];
    spacing: number;
  }>;
  expectedSpacing: number;
  deviations: number[];
}

export interface LayoutGridAnalysis {
  elements: string[];
  gridAnalysis: {
    columnsDetected: number;
    rowsDetected: number;
    gutterWidth: number;
    gutterHeight: number;
    alignmentIssues: AlignmentIssue[];
  };
  spacingConsistency: {
    horizontalSpacings: number[];
    verticalSpacings: number[];
    inconsistencies: SpacingInconsistency[];
  };
}

export interface Viewport {
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
}

export interface BreakpointChange {
  property: string;
  fromValue: string;
  toValue: string;
  impact: 'layout' | 'style' | 'visibility';
}

export interface ReflowMetrics {
  elementsAffected: number;
  layoutShift: number;
  reorderingOccurred: boolean;
}

export interface VisibilityChanges {
  wasVisible: boolean;
  isVisible: boolean;
  reason?: 'hidden' | 'display-none' | 'off-screen' | 'overlapped';
}

export interface ResponsiveIssue {
  viewport: Viewport;
  type: 'overflow' | 'text-too-small' | 'touch-target' | 'layout-break';
  severity: 'critical' | 'major' | 'minor';
  description: string;
  affectedElements: string[];
}

export interface ResponsiveAnalysis {
  selector: string;
  viewports: Viewport[];
  analysis: Array<{
    viewport: Viewport;
    measurements: ElementMeasurement;
    breakpointChanges: BreakpointChange[];
    reflow: ReflowMetrics;
    visibility: VisibilityChanges;
  }>;
  responsiveScore: {
    score: number;
    issues: ResponsiveIssue[];
    recommendations: string[];
  };
}