import fs from 'fs/promises';
import path from 'path';
import { ToolResponse } from '../../../types/mcp';

export class SaveScreenshotTool {
  private screenshotDir: string;

  constructor(screenshotDir = './screenshots') {
    this.screenshotDir = screenshotDir;
  }

  async saveScreenshot(base64Data: string, filename?: string): Promise<ToolResponse> {
    try {
      // Ensure directory exists
      await fs.mkdir(this.screenshotDir, { recursive: true });

      // Generate filename if not provided
      if (!filename) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        filename = `screenshot-${timestamp}.png`;
      }

      // Ensure .png extension
      if (!filename.endsWith('.png') && !filename.endsWith('.jpg') && !filename.endsWith('.jpeg')) {
        filename += '.png';
      }

      const filepath = path.join(this.screenshotDir, filename);

      // Remove data URL prefix if present
      const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');

      // Convert base64 to buffer and save
      const buffer = Buffer.from(base64Clean, 'base64');
      await fs.writeFile(filepath, buffer);

      // Get file stats
      const stats = await fs.stat(filepath);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            filepath: filepath,
            filename: filename,
            size: stats.size,
            savedAt: new Date().toISOString(),
            message: `Screenshot saved successfully to ${filepath}`
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: String(error),
            message: 'Failed to save screenshot'
          }, null, 2)
        }]
      };
    }
  }

  async listScreenshots(): Promise<ToolResponse> {
    try {
      await fs.mkdir(this.screenshotDir, { recursive: true });
      
      const files = await fs.readdir(this.screenshotDir);
      const screenshots = files.filter(file => 
        file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')
      );

      const screenshotInfo = await Promise.all(
        screenshots.map(async (file) => {
          const filepath = path.join(this.screenshotDir, file);
          const stats = await fs.stat(filepath);
          return {
            filename: file,
            filepath: filepath,
            size: stats.size,
            created: stats.birthtime.toISOString(),
            modified: stats.mtime.toISOString()
          };
        })
      );

      // Sort by creation time, newest first
      screenshotInfo.sort((a, b) => 
        new Date(b.created).getTime() - new Date(a.created).getTime()
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            count: screenshotInfo.length,
            directory: this.screenshotDir,
            screenshots: screenshotInfo
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: String(error),
            message: 'Failed to list screenshots'
          }, null, 2)
        }]
      };
    }
  }
}