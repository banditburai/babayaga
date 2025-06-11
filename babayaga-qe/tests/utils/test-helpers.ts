/**
 * Common test helper functions for babayaga-qe tests
 */

export interface MockElement {
  id: string;
  selector: string;
  dimensions: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
}

/**
 * Create mock element data for testing
 */
export function createMockElement(overrides: Partial<MockElement> = {}): MockElement {
  return {
    id: 'test-element',
    selector: '#test-element',
    dimensions: {
      width: 100,
      height: 50,
      x: 10,
      y: 20,
    },
    ...overrides,
  };
}

/**
 * Create mock measurement result
 */
export function createMockMeasurement(selector: string, overrides: any = {}) {
  return {
    selector,
    dimensions: {
      width: 100,
      height: 50,
      x: 10,
      y: 20,
    },
    boxModel: {
      content: { x: 10, y: 20, width: 100, height: 50 },
      padding: { x: 5, y: 15, width: 110, height: 60 },
      border: { x: 4, y: 14, width: 112, height: 62 },
      margin: { x: 4, y: 14, width: 112, height: 62 },
    },
    typography: {
      fontSize: '16px',
      lineHeight: 'normal',
      fontFamily: 'Arial',
      fontWeight: '400',
    },
    spacing: {
      marginTop: 0,
      marginRight: 0,
      marginBottom: 0,
      marginLeft: 0,
      paddingTop: 5,
      paddingRight: 5,
      paddingBottom: 5,
      paddingLeft: 5,
    },
    visibility: {
      isVisible: true,
      opacity: 1,
      zIndex: 'auto',
    },
    ...overrides,
  };
}

/**
 * Wait for a specified amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock CDP health check response
 */
export function createMockHealthCheck(overrides: any = {}) {
  return {
    overall: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      cdpConnection: {
        status: 'pass',
        message: 'CDP connection active',
        duration: 0,
      },
      targetAvailability: {
        status: 'pass',
        message: '1 target(s) available',
        details: {
          targetCount: 1,
          targets: [
            {
              id: 'test-target-id',
              title: 'Test Page',
              url: 'http://localhost:3000/test',
            },
          ],
        },
        duration: 2,
      },
      browserResponsiveness: {
        status: 'pass',
        message: 'Browser responded in 1ms',
        details: {
          responseTime: 1,
        },
        duration: 1,
      },
      systemResources: {
        status: 'pass',
        message: 'Memory usage: 15.0MB',
        details: {
          memory: {
            heapUsed: 15.0,
            heapTotal: 20.0,
            external: 5.0,
          },
          cpu: {
            user: 1000000,
            system: 200000,
          },
        },
        duration: 0,
      },
    },
    metrics: {
      uptime: 60000,
      totalCommands: 10,
      failedCommands: 0,
      averageResponseTime: 25,
    },
    ...overrides,
  };
}