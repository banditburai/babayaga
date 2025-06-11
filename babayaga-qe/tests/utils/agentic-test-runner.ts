/**
 * Test runner for agentic testing through MCP tools
 * This replaces traditional unit test frameworks for our use case
 */

export interface AgenticTestResult {
  testName: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
  data?: any;
}

export interface AgenticTestSuite {
  suiteName: string;
  tests: AgenticTestResult[];
  totalDuration: number;
  passCount: number;
  failCount: number;
  skipCount: number;
}

export class AgenticTestRunner {
  private results: AgenticTestResult[] = [];
  private currentSuite: string = '';

  /**
   * Start a new test suite
   */
  startSuite(suiteName: string): void {
    this.currentSuite = suiteName;
    this.results = [];
    console.log(`\n🧪 Starting test suite: ${suiteName}`);
  }

  /**
   * Run a single test through MCP tools
   */
  async runTest(
    testName: string,
    testFn: () => Promise<any>
  ): Promise<AgenticTestResult> {
    const startTime = Date.now();
    
    try {
      console.log(`  ⏳ Running: ${testName}`);
      const data = await testFn();
      const duration = Date.now() - startTime;
      
      const result: AgenticTestResult = {
        testName,
        status: 'pass',
        duration,
        data,
      };
      
      this.results.push(result);
      console.log(`  ✅ ${testName} (${duration}ms)`);
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: AgenticTestResult = {
        testName,
        status: 'fail',
        duration,
        error: error instanceof Error ? error.message : String(error),
      };
      
      this.results.push(result);
      console.log(`  ❌ ${testName} (${duration}ms): ${result.error}`);
      return result;
    }
  }

  /**
   * Skip a test
   */
  skipTest(testName: string, reason: string): AgenticTestResult {
    const result: AgenticTestResult = {
      testName,
      status: 'skip',
      duration: 0,
      error: reason,
    };
    
    this.results.push(result);
    console.log(`  ⏭️  ${testName} (skipped: ${reason})`);
    return result;
  }

  /**
   * Complete the test suite and return results
   */
  completeSuite(): AgenticTestSuite {
    const passCount = this.results.filter(r => r.status === 'pass').length;
    const failCount = this.results.filter(r => r.status === 'fail').length;
    const skipCount = this.results.filter(r => r.status === 'skip').length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    const suite: AgenticTestSuite = {
      suiteName: this.currentSuite,
      tests: [...this.results],
      totalDuration,
      passCount,
      failCount,
      skipCount,
    };

    console.log(`\n📊 Test suite completed: ${this.currentSuite}`);
    console.log(`  ✅ Passed: ${passCount}`);
    console.log(`  ❌ Failed: ${failCount}`);
    console.log(`  ⏭️  Skipped: ${skipCount}`);
    console.log(`  ⏱️  Total time: ${totalDuration}ms`);

    return suite;
  }

  /**
   * Assert that a condition is true
   */
  static assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  /**
   * Assert that two values are equal
   */
  static assertEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      const msg = message || `Expected ${expected}, got ${actual}`;
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  /**
   * Assert that a value is within a range
   */
  static assertWithinRange(
    value: number,
    min: number,
    max: number,
    message?: string
  ): void {
    if (value < min || value > max) {
      const msg = message || `Expected ${value} to be between ${min} and ${max}`;
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  /**
   * Assert that operation completes within time limit
   */
  static assertPerformance(
    duration: number,
    maxDuration: number,
    operation: string
  ): void {
    if (duration > maxDuration) {
      throw new Error(
        `Performance assertion failed: ${operation} took ${duration}ms, expected < ${maxDuration}ms`
      );
    }
  }
}

/**
 * Global test runner instance
 */
export const testRunner = new AgenticTestRunner();