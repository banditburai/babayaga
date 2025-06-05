import puppeteer from 'puppeteer';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'fs/promises';
import { join } from 'path';

interface VisualDiffResult {
  diffPercentage: number;
  diffImagePath: string;
  performanceMetrics: {
    loadTime: number;
    firstPaint: number;
    firstContentfulPaint: number;
  };
}

export class VisualRegressionTool {
  private browser: any;
  private baselineDir: string;
  private diffDir: string;

  constructor(baselineDir = 'baseline', diffDir = 'diffs') {
    this.baselineDir = baselineDir;
    this.diffDir = diffDir;
  }

  async initialize() {
    // Connect to existing browser instance
    this.browser = await puppeteer.connect({
      browserURL: 'http://localhost:9222',
      defaultViewport: null,
    });
  }

  async comparePage(url: string, name: string): Promise<VisualDiffResult> {
    const page = await this.browser.newPage();
    
    // Start performance measurement
    const startTime = Date.now();
    
    // Navigate to the page
    await page.goto(url, { waitUntil: 'networkidle0' });
    
    // Get performance metrics using Puppeteer's built-in CDP
    const client = await page.target().createCDPSession();
    await client.send('Performance.enable');
    const metrics = await client.send('Performance.getMetrics');
    const performanceMetrics = {
      loadTime: Date.now() - startTime,
      firstPaint: metrics.metrics.find((m: any) => m.name === 'FirstPaint')?.value || 0,
      firstContentfulPaint: metrics.metrics.find((m: any) => m.name === 'FirstContentfulPaint')?.value || 0,
    };

    // Take screenshot
    const screenshot = await page.screenshot({ fullPage: true });
    
    // Compare with baseline
    const diffResult = await this.compareWithBaseline(screenshot, name);
    
    // Clean up
    await page.close();
    
    return {
      ...diffResult,
      performanceMetrics,
    };
  }

  private async compareWithBaseline(
    currentScreenshot: Buffer,
    name: string
  ): Promise<{ diffPercentage: number; diffImagePath: string }> {
    const baselinePath = join(this.baselineDir, `${name}.png`);
    const diffPath = join(this.diffDir, `${name}-diff.png`);
    
    // Ensure directories exist
    await fs.mkdir(this.baselineDir, { recursive: true });
    await fs.mkdir(this.diffDir, { recursive: true });
    
    // Read or create baseline
    let baselineImage: PNG;
    try {
      const baselineBuffer = await fs.readFile(baselinePath);
      baselineImage = PNG.sync.read(baselineBuffer);
    } catch {
      // No baseline exists, create one
      await fs.writeFile(baselinePath, currentScreenshot);
      return { diffPercentage: 0, diffImagePath: '' };
    }
    
    // Compare images
    const currentImage = PNG.sync.read(currentScreenshot);
    const { width, height } = baselineImage;
    const diff = new PNG({ width, height });
    
    const diffPixels = pixelmatch(
      baselineImage.data,
      currentImage.data,
      diff.data,
      width,
      height,
      { threshold: 0.1 }
    );
    
    const diffPercentage = (diffPixels / (width * height)) * 100;
    
    // Save diff image if there are differences
    if (diffPixels > 0) {
      await fs.writeFile(diffPath, PNG.sync.write(diff));
    }
    
    return {
      diffPercentage,
      diffImagePath: diffPixels > 0 ? diffPath : '',
    };
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.disconnect();
    }
  }
}

// Example usage
async function main() {
  const tool = new VisualRegressionTool();
  await tool.initialize();
  
  try {
    const result = await tool.comparePage('http://localhost:8888', 'homepage');
    console.log('Visual Regression Results:', result);
  } finally {
    await tool.cleanup();
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}