/**
 * Calculation utilities for measurements and geometry
 */

import { BoundingBox } from '../types/measurement-types.js';

/**
 * Calculate the distance between two points
 */
export function distanceBetweenPoints(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

/**
 * Calculate the minimum distance between two bounding boxes
 */
export function minimumDistanceBetweenBoxes(box1: BoundingBox, box2: BoundingBox): number {
  // Check if boxes overlap
  if (boxesOverlap(box1, box2)) {
    return 0;
  }

  // Calculate distances between all edges
  const distances: number[] = [];

  // Horizontal distances
  if (box1.x + box1.width < box2.x) {
    distances.push(box2.x - (box1.x + box1.width));
  } else if (box2.x + box2.width < box1.x) {
    distances.push(box1.x - (box2.x + box2.width));
  } else {
    distances.push(0);
  }

  // Vertical distances
  if (box1.y + box1.height < box2.y) {
    distances.push(box2.y - (box1.y + box1.height));
  } else if (box2.y + box2.height < box1.y) {
    distances.push(box1.y - (box2.y + box2.height));
  } else {
    distances.push(0);
  }

  // If boxes are diagonally separated, calculate corner distances
  if (distances[0] > 0 && distances[1] > 0) {
    return Math.sqrt(distances[0] * distances[0] + distances[1] * distances[1]);
  }

  return Math.max(...distances);
}

/**
 * Check if two bounding boxes overlap
 */
export function boxesOverlap(box1: BoundingBox, box2: BoundingBox): boolean {
  return !(
    box1.x + box1.width < box2.x ||
    box2.x + box2.width < box1.x ||
    box1.y + box1.height < box2.y ||
    box2.y + box2.height < box1.y
  );
}

/**
 * Calculate the center point of a bounding box
 */
export function getBoxCenter(box: BoundingBox): { x: number; y: number } {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

/**
 * Determine the spatial relationship between two boxes
 */
export function getBoxRelationship(box1: BoundingBox, box2: BoundingBox): 'above' | 'below' | 'left' | 'right' | 'overlapping' {
  if (boxesOverlap(box1, box2)) {
    return 'overlapping';
  }

  const center1 = getBoxCenter(box1);
  const center2 = getBoxCenter(box2);

  const horizontalDiff = Math.abs(center1.x - center2.x);
  const verticalDiff = Math.abs(center1.y - center2.y);

  if (horizontalDiff > verticalDiff) {
    return center1.x < center2.x ? 'left' : 'right';
  } else {
    return center1.y < center2.y ? 'above' : 'below';
  }
}

/**
 * Check alignment between boxes
 */
export function checkAlignment(
  box1: BoundingBox,
  box2: BoundingBox,
  tolerance: number = 2
): {
  horizontalAlignment: 'left' | 'center' | 'right' | 'none';
  verticalAlignment: 'top' | 'middle' | 'bottom' | 'none';
} {
  const center1 = getBoxCenter(box1);
  const center2 = getBoxCenter(box2);

  // Check horizontal alignment
  let horizontalAlignment: 'left' | 'center' | 'right' | 'none' = 'none';
  if (Math.abs(box1.x - box2.x) <= tolerance) {
    horizontalAlignment = 'left';
  } else if (Math.abs(center1.x - center2.x) <= tolerance) {
    horizontalAlignment = 'center';
  } else if (Math.abs((box1.x + box1.width) - (box2.x + box2.width)) <= tolerance) {
    horizontalAlignment = 'right';
  }

  // Check vertical alignment
  let verticalAlignment: 'top' | 'middle' | 'bottom' | 'none' = 'none';
  if (Math.abs(box1.y - box2.y) <= tolerance) {
    verticalAlignment = 'top';
  } else if (Math.abs(center1.y - center2.y) <= tolerance) {
    verticalAlignment = 'middle';
  } else if (Math.abs((box1.y + box1.height) - (box2.y + box2.height)) <= tolerance) {
    verticalAlignment = 'bottom';
  }

  return { horizontalAlignment, verticalAlignment };
}

/**
 * Find the most common spacing value from an array of spacings
 */
export function findCommonSpacing(spacings: number[], tolerance: number = 2): number {
  if (spacings.length === 0) return 0;
  if (spacings.length === 1) return spacings[0];

  // Group similar spacings
  const groups: number[][] = [];
  
  spacings.forEach(spacing => {
    let added = false;
    for (const group of groups) {
      if (Math.abs(spacing - group[0]) <= tolerance) {
        group.push(spacing);
        added = true;
        break;
      }
    }
    if (!added) {
      groups.push([spacing]);
    }
  });

  // Find the largest group
  const largestGroup = groups.reduce((prev, current) => 
    current.length > prev.length ? current : prev
  );

  // Return the average of the largest group
  return largestGroup.reduce((sum, val) => sum + val, 0) / largestGroup.length;
}

/**
 * Calculate grid metrics from element positions
 */
export function calculateGridMetrics(
  boxes: BoundingBox[],
  tolerance: number = 2
): {
  columns: number;
  rows: number;
  gutterWidth: number;
  gutterHeight: number;
} {
  if (boxes.length < 2) {
    return { columns: 1, rows: 1, gutterWidth: 0, gutterHeight: 0 };
  }

  // Sort boxes by position
  const sortedByX = [...boxes].sort((a, b) => a.x - b.x);
  const sortedByY = [...boxes].sort((a, b) => a.y - b.y);

  // Detect columns
  const uniqueX: number[] = [];
  sortedByX.forEach(box => {
    if (!uniqueX.some(x => Math.abs(x - box.x) <= tolerance)) {
      uniqueX.push(box.x);
    }
  });

  // Detect rows
  const uniqueY: number[] = [];
  sortedByY.forEach(box => {
    if (!uniqueY.some(y => Math.abs(y - box.y) <= tolerance)) {
      uniqueY.push(box.y);
    }
  });

  // Calculate gutters
  const horizontalSpacings: number[] = [];
  for (let i = 1; i < sortedByX.length; i++) {
    const spacing = sortedByX[i].x - (sortedByX[i - 1].x + sortedByX[i - 1].width);
    if (spacing > 0) {
      horizontalSpacings.push(spacing);
    }
  }

  const verticalSpacings: number[] = [];
  for (let i = 1; i < sortedByY.length; i++) {
    const spacing = sortedByY[i].y - (sortedByY[i - 1].y + sortedByY[i - 1].height);
    if (spacing > 0) {
      verticalSpacings.push(spacing);
    }
  }

  return {
    columns: uniqueX.length,
    rows: uniqueY.length,
    gutterWidth: findCommonSpacing(horizontalSpacings, tolerance),
    gutterHeight: findCommonSpacing(verticalSpacings, tolerance),
  };
}

/**
 * Calculate visual weight based on size and position
 */
export function calculateVisualWeight(box: BoundingBox, viewportWidth: number, viewportHeight: number): number {
  const area = box.width * box.height;
  const viewportArea = viewportWidth * viewportHeight;
  const sizeWeight = area / viewportArea;

  // Position weight (elements higher and more centered have more weight)
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const horizontalCenterDistance = Math.abs(centerX - viewportWidth / 2) / (viewportWidth / 2);
  const verticalPosition = centerY / viewportHeight;
  
  const positionWeight = (1 - horizontalCenterDistance) * (1 - verticalPosition);

  return sizeWeight * 0.7 + positionWeight * 0.3;
}