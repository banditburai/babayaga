/**
 * Element measurement and analysis tools
 */

import { CDPClient } from '../cdp-client.js';
import { ElementMeasurement, DistanceMeasurement, LayoutGridAnalysis, BoundingBox } from '../types/measurement-types.js';
import { 
  MeasureElementDimensionsInput, 
  MeasureElementDistancesInput, 
  AnalyzeLayoutGridInput 
} from '../types/validation-schemas.js';
import { 
  minimumDistanceBetweenBoxes, 
  getBoxRelationship, 
  checkAlignment, 
  calculateGridMetrics,
  findCommonSpacing,
  getBoxCenter,
  distanceBetweenPoints
} from '../utils/calculation-utils.js';
import { CDPCommandError } from '../utils.js';
import { logger } from '@babayaga/shared';

/**
 * Measure comprehensive dimensions and properties of an element
 */
export async function measureElementDimensions(
  client: CDPClient,
  input: MeasureElementDimensionsInput & { rootNodeId?: number }
): Promise<ElementMeasurement> {
  const { selector, includeTypography = true, includeBoxModel = true } = input;

  try {
    // Get DOM node - use provided rootNodeId or fetch a new one
    const rootNodeId = input.rootNodeId ?? await getRootNodeId(client);
    const querySelectorResponse = await client.sendCommand('DOM.querySelector', {
      nodeId: rootNodeId,
      selector
    });
    
    const nodeId = (querySelectorResponse.result as any)?.nodeId;
    if (!nodeId || nodeId === 0) {
      logger.debug('Element not found', { selector, rootNodeId, response: querySelectorResponse });
      throw new CDPCommandError(`Element not found: ${selector}. Make sure the selector is valid and the element exists in the DOM.`, 'DOM.querySelector');
    }

    // Get box model
    const boxModelResponse = await client.sendCommand('DOM.getBoxModel', { nodeId });
    const model = (boxModelResponse.result as any)?.model;
    
    if (!model) {
      throw new CDPCommandError(`Could not get box model for: ${selector}`, 'DOM.getBoxModel');
    }

    // Get computed styles
    const computedStyleResponse = await client.sendCommand('CSS.getComputedStyleForNode', { nodeId });
    const computedStyle = (computedStyleResponse.result as any)?.computedStyle || [];

    // Parse computed styles into a map
    const styleMap = new Map<string, string>();
    computedStyle.forEach((style: { name: string; value: string }) => {
      styleMap.set(style.name, style.value);
    });

    // Build bounding boxes from the model
    const content: BoundingBox = {
      x: model.content[0],
      y: model.content[1],
      width: model.content[4] - model.content[0],
      height: model.content[5] - model.content[1]
    };

    const padding: BoundingBox = {
      x: model.padding[0],
      y: model.padding[1],
      width: model.padding[4] - model.padding[0],
      height: model.padding[5] - model.padding[1]
    };

    const border: BoundingBox = {
      x: model.border[0],
      y: model.border[1],
      width: model.border[4] - model.border[0],
      height: model.border[5] - model.border[1]
    };

    const margin: BoundingBox = {
      x: model.margin[0],
      y: model.margin[1],
      width: model.margin[4] - model.margin[0],
      height: model.margin[5] - model.margin[1]
    };

    // Parse spacing values
    const parsePixelValue = (value: string): number => {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    };

    const measurement: ElementMeasurement = {
      selector,
      dimensions: {
        width: content.width,
        height: content.height,
        x: content.x,
        y: content.y
      },
      boxModel: includeBoxModel ? {
        content,
        padding,
        border,
        margin
      } : {
        content,
        padding: content,
        border: content,
        margin: content
      },
      typography: includeTypography ? {
        fontSize: styleMap.get('font-size') || '',
        lineHeight: styleMap.get('line-height') || '',
        fontFamily: styleMap.get('font-family') || '',
        fontWeight: styleMap.get('font-weight') || ''
      } : {
        fontSize: '',
        lineHeight: '',
        fontFamily: '',
        fontWeight: ''
      },
      spacing: {
        marginTop: parsePixelValue(styleMap.get('margin-top') || '0'),
        marginRight: parsePixelValue(styleMap.get('margin-right') || '0'),
        marginBottom: parsePixelValue(styleMap.get('margin-bottom') || '0'),
        marginLeft: parsePixelValue(styleMap.get('margin-left') || '0'),
        paddingTop: parsePixelValue(styleMap.get('padding-top') || '0'),
        paddingRight: parsePixelValue(styleMap.get('padding-right') || '0'),
        paddingBottom: parsePixelValue(styleMap.get('padding-bottom') || '0'),
        paddingLeft: parsePixelValue(styleMap.get('padding-left') || '0')
      },
      visibility: {
        isVisible: styleMap.get('visibility') !== 'hidden' && styleMap.get('display') !== 'none',
        opacity: parseFloat(styleMap.get('opacity') || '1'),
        zIndex: styleMap.get('z-index') || 'auto'
      }
    };

    logger.debug('Element measured successfully', { selector, dimensions: measurement.dimensions });
    return measurement;

  } catch (error) {
    logger.error('Failed to measure element', { selector, error });
    throw error;
  }
}

/**
 * Measure distances and relationships between two elements
 */
export async function measureElementDistances(
  client: CDPClient,
  input: MeasureElementDistancesInput
): Promise<DistanceMeasurement> {
  const { elementA, elementB } = input;

  try {
    // Get root node ID once to share across measurements
    const rootNodeId = await getRootNodeId(client);
    logger.debug('measureElementDistances: Got shared root node ID', { rootNodeId, elementA, elementB });
    
    // Measure both elements with the same root node ID
    const [measurementA, measurementB] = await Promise.all([
      measureElementDimensions(client, { selector: elementA, includeTypography: true, includeBoxModel: true, rootNodeId }),
      measureElementDimensions(client, { selector: elementB, includeTypography: true, includeBoxModel: true, rootNodeId })
    ]);

    const boxA = measurementA.boxModel.border;
    const boxB = measurementB.boxModel.border;

    // Calculate centers
    const centerA = getBoxCenter(boxA);
    const centerB = getBoxCenter(boxB);

    // Calculate distances
    const horizontalDistance = Math.abs(centerB.x - centerA.x);
    const verticalDistance = Math.abs(centerB.y - centerA.y);
    const diagonalDistance = distanceBetweenPoints(centerA.x, centerA.y, centerB.x, centerB.y);
    const closestEdgeDistance = minimumDistanceBetweenBoxes(boxA, boxB);

    // Determine relationship and alignment
    const relationship = getBoxRelationship(boxA, boxB);
    const alignment = checkAlignment(boxA, boxB);

    const distanceMeasurement: DistanceMeasurement = {
      elementA,
      elementB,
      distances: {
        horizontal: horizontalDistance,
        vertical: verticalDistance,
        diagonal: diagonalDistance,
        closestEdge: closestEdgeDistance
      },
      relationship,
      alignment
    };

    logger.debug('Element distances measured', { elementA, elementB, relationship });
    return distanceMeasurement;

  } catch (error) {
    logger.error('Failed to measure element distances', { elementA, elementB, error });
    throw error;
  }
}

/**
 * Analyze layout grid and spacing consistency
 */
export async function analyzeLayoutGrid(
  client: CDPClient,
  input: AnalyzeLayoutGridInput
): Promise<LayoutGridAnalysis> {
  const { elements, tolerancePixels = 2 } = input;

  try {
    // Get root node ID once to share across all measurements
    const rootNodeId = await getRootNodeId(client);
    
    // Measure all elements with the same root node ID
    const measurements = await Promise.all(
      elements.map(selector => measureElementDimensions(client, { selector, includeTypography: true, includeBoxModel: true, rootNodeId }))
    );

    // Extract bounding boxes
    const boxes = measurements.map(m => m.boxModel.border);

    // Calculate grid metrics
    const gridMetrics = calculateGridMetrics(boxes, tolerancePixels);

    // Analyze spacing between elements
    const horizontalSpacings: number[] = [];
    const verticalSpacings: number[] = [];
    const alignmentIssues: LayoutGridAnalysis['gridAnalysis']['alignmentIssues'] = [];

    // Sort boxes by position for spacing analysis
    const sortedByX = [...measurements].sort((a, b) => a.boxModel.border.x - b.boxModel.border.x);
    const sortedByY = [...measurements].sort((a, b) => a.boxModel.border.y - b.boxModel.border.y);

    // Calculate horizontal spacings
    for (let i = 1; i < sortedByX.length; i++) {
      const prevBox = sortedByX[i - 1].boxModel.border;
      const currBox = sortedByX[i].boxModel.border;
      const spacing = currBox.x - (prevBox.x + prevBox.width);
      if (spacing > 0) {
        horizontalSpacings.push(spacing);
      }
    }

    // Calculate vertical spacings
    for (let i = 1; i < sortedByY.length; i++) {
      const prevBox = sortedByY[i - 1].boxModel.border;
      const currBox = sortedByY[i].boxModel.border;
      const spacing = currBox.y - (prevBox.y + prevBox.height);
      if (spacing > 0) {
        verticalSpacings.push(spacing);
      }
    }

    // Check for alignment issues
    const expectedHorizontalSpacing = findCommonSpacing(horizontalSpacings, tolerancePixels);

    // Find horizontal alignment issues
    const xPositions = measurements.map(m => m.boxModel.border.x);
    const uniqueXPositions = [...new Set(xPositions)];
    
    uniqueXPositions.forEach(expectedX => {
      const alignedElements = measurements.filter(m => 
        Math.abs(m.boxModel.border.x - expectedX) <= tolerancePixels
      );
      
      if (alignedElements.length > 1) {
        const actualAlignments = alignedElements.map(m => m.boxModel.border.x);
        const deviations = actualAlignments.map(x => Math.abs(x - expectedX));
        const maxDeviation = Math.max(...deviations);
        
        if (maxDeviation > tolerancePixels) {
          alignmentIssues.push({
            elements: alignedElements.map(m => m.selector),
            type: 'horizontal',
            expectedAlignment: expectedX,
            actualAlignments,
            deviation: maxDeviation
          });
        }
      }
    });

    // Find spacing inconsistencies
    const spacingInconsistencies: LayoutGridAnalysis['spacingConsistency']['inconsistencies'] = [];
    
    // Check horizontal spacing consistency
    horizontalSpacings.forEach((spacing, index) => {
      if (Math.abs(spacing - expectedHorizontalSpacing) > tolerancePixels) {
        spacingInconsistencies.push({
          type: 'horizontal',
          locations: [{
            elements: [sortedByX[index].selector, sortedByX[index + 1].selector],
            spacing
          }],
          expectedSpacing: expectedHorizontalSpacing,
          deviations: [Math.abs(spacing - expectedHorizontalSpacing)]
        });
      }
    });

    const layoutAnalysis: LayoutGridAnalysis = {
      elements,
      gridAnalysis: {
        columnsDetected: gridMetrics.columns,
        rowsDetected: gridMetrics.rows,
        gutterWidth: gridMetrics.gutterWidth,
        gutterHeight: gridMetrics.gutterHeight,
        alignmentIssues
      },
      spacingConsistency: {
        horizontalSpacings,
        verticalSpacings,
        inconsistencies: spacingInconsistencies
      }
    };

    logger.debug('Layout grid analyzed', { 
      elements: elements.length, 
      columns: gridMetrics.columns, 
      rows: gridMetrics.rows 
    });
    
    return layoutAnalysis;

  } catch (error) {
    logger.error('Failed to analyze layout grid', { elements, error });
    throw error;
  }
}

/**
 * Helper function to get root node ID
 */
async function getRootNodeId(client: CDPClient): Promise<number> {
  try {
    // Ensure DOM and CSS domains are enabled
    await ensureDomainsEnabled(client);
    
    const response = await client.sendCommand('DOM.getDocument', { depth: 0 });
    const root = (response.result as any)?.root;
    if (!root || !root.nodeId) {
      logger.error('Invalid DOM.getDocument response', { response });
      throw new CDPCommandError('Failed to get document root. DOM might not be enabled.', 'DOM.getDocument');
    }
    return root.nodeId;
  } catch (error) {
    logger.error('Failed to get root node ID', { error });
    throw new CDPCommandError('Failed to get document root. Make sure DOM is enabled (DOM.enable).', 'DOM.getDocument');
  }
}

/**
 * Ensure DOM and CSS domains are enabled
 */
async function ensureDomainsEnabled(client: CDPClient): Promise<void> {
  try {
    await Promise.all([
      client.sendCommand('DOM.enable', {}),
      client.sendCommand('CSS.enable', {})
    ]);
  } catch (error) {
    logger.warn('Failed to enable domains, they might already be enabled', { error });
  }
}