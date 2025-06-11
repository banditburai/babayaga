/**
 * Agent Checklist Coordinator
 * Coordinates between agents and the checklist system, providing MCP tools for checklist execution
 */

import { ChecklistAgentRunner, TestChecklistItem } from './checklist-agent-runner.js';
import { EvidenceCollector } from './evidence-collector.js';
import { logger } from '@babayaga/shared';

export class AgentChecklistCoordinator {
  private runners: Map<string, ChecklistAgentRunner> = new Map();
  private activeAgents: Set<string> = new Set();

  /**
   * Initialize a new checklist session for an agent
   */
  async initializeAgentChecklist(agentId: string, checklistPath: string): Promise<string> {
    // Load checklist from file
    const checklist = await this.loadChecklistFromFile(checklistPath);
    
    // Create new runner for this agent
    const runner = new ChecklistAgentRunner(agentId);
    const evidenceCollector = new EvidenceCollector(agentId);
    runner.setEvidenceCollector(evidenceCollector);
    await runner.loadChecklist(checklist);
    
    this.runners.set(agentId, runner);
    this.activeAgents.add(agentId);
    
    logger.info(`🎯 Initialized checklist for agent ${agentId} with ${checklist.length} tests`);
    
    const status = runner.getChecklistStatus();
    return `Checklist initialized successfully for agent ${agentId}. 
Ready to execute ${status.total} tests.
Use 'get_next_test' to start testing.`;
  }

  /**
   * Get the next test item for an agent to work on
   */
  async getNextTestForAgent(agentId: string): Promise<string> {
    const runner = this.getRunnerForAgent(agentId);
    const currentItem = runner.getCurrentTestItem();
    
    if (!currentItem) {
      return `All tests completed! Use 'get_checklist_report' to see final results.`;
    }
    
    const instructions = await runner.startTestItem(currentItem.id);
    
    return `📋 Next Test: ${currentItem.title}

**Description:** ${currentItem.description}

**Instructions:** ${instructions.instructions}

**Expected Outcome:** ${instructions.expectedOutcome}

**Verification Criteria:**
${instructions.verificationCriteria.map(c => `• ${c}`).join('\n')}

**Evidence Requirements:**
${instructions.evidenceRequirements.map(r => `• ${r}`).join('\n')}

**Test ID:** ${currentItem.id}

Use the following tools to execute this test:
- 'log_test_action' to log what you're doing
- 'record_tool_call' after each MCP tool use
- 'complete_test_item' when finished
- 'skip_test_item' if test cannot be completed`;
  }

  /**
   * Log an action the agent is taking during test execution
   */
  async logTestAction(agentId: string, itemId: string, action: string, context?: any): Promise<string> {
    const runner = this.getRunnerForAgent(agentId);
    await runner.logAction(itemId, action, context);
    
    return `✓ Logged action: ${action}`;
  }

  /**
   * Record a tool call made by the agent
   */
  async recordAgentToolCall(
    agentId: string,
    itemId: string,
    toolName: string,
    parameters: any,
    response: any,
    duration: number,
    success: boolean
  ): Promise<string> {
    const runner = this.getRunnerForAgent(agentId);
    await runner.recordToolCall(itemId, toolName, parameters, response, duration, success);
    
    const status = success ? '✅' : '❌';
    return `${status} Recorded tool call: ${toolName} (${duration}ms)`;
  }

  /**
   * Complete a test item with results and comments
   */
  async completeTestItem(
    agentId: string,
    itemId: string,
    passed: boolean,
    comments: string,
    additionalEvidence?: any
  ): Promise<string> {
    const runner = this.getRunnerForAgent(agentId);
    const completion = await runner.completeTestItem(itemId, passed, comments, additionalEvidence);
    
    let result = `${passed ? '✅' : '❌'} Test ${itemId} completed: ${passed ? 'PASSED' : 'FAILED'}

**Comments:** ${comments}

**Evidence Quality:** ${completion.verification.evidenceQuality || 'N/A'}%`;

    if (completion.verification.issues.length > 0) {
      result += `\n\n**Evidence Issues:**\n${completion.verification.issues.map(i => `• ${i}`).join('\n')}`;
    }

    if (completion.nextItemId) {
      result += `\n\n**Next:** Use 'get_next_test' to continue with the next test item.`;
    } else {
      result += `\n\n**Completed:** All tests finished! Use 'get_checklist_report' for final results.`;
    }

    return result;
  }

  /**
   * Skip a test item with reason
   */
  async skipTestItem(agentId: string, itemId: string, reason: string): Promise<string> {
    const runner = this.getRunnerForAgent(agentId);
    await runner.skipTestItem(itemId, reason);
    
    return `⏭️ Test ${itemId} skipped: ${reason}

Use 'get_next_test' to continue with the next test item.`;
  }

  /**
   * Get current checklist status
   */
  async getChecklistStatus(agentId: string): Promise<string> {
    const runner = this.getRunnerForAgent(agentId);
    const status = runner.getChecklistStatus();
    
    return `📊 Checklist Status for Agent ${agentId}:

**Progress:** ${status.completed + status.failed + status.skipped}/${status.total} tests processed
• ✅ Completed: ${status.completed}
• ❌ Failed: ${status.failed}  
• ⏭️ Skipped: ${status.skipped}
• ⏳ In Progress: ${status.inProgress}
• ⏸️ Pending: ${status.pending}

**Success Rate:** ${status.successRate.toFixed(1)}%
**Total Duration:** ${(status.totalDuration / 1000).toFixed(1)} seconds
**Current Test:** ${status.currentItemIndex + 1}/${status.total}`;
  }

  /**
   * Generate final checklist report
   */
  async generateChecklistReport(agentId: string): Promise<string> {
    const runner = this.getRunnerForAgent(agentId);
    const report = runner.generateReport();
    
    let output = `📋 Final Checklist Report
**Agent:** ${report.agentId}
**Session:** ${report.sessionId}
**Duration:** ${new Date(report.endTime).getTime() - new Date(report.startTime).getTime()}ms

**Overall Results:**
• Total Tests: ${report.status.total}
• ✅ Passed: ${report.status.completed}
• ❌ Failed: ${report.status.failed}
• ⏭️ Skipped: ${report.status.skipped}
• 📈 Success Rate: ${report.status.successRate.toFixed(1)}%

**Test Details:**`;

    for (const detail of report.details) {
      const statusIcon = this.getStatusIcon(detail.status);
      output += `\n${statusIcon} ${detail.id}: ${detail.title}`;
      if (detail.duration > 0) {
        output += ` (${detail.duration}ms)`;
      }
      if (detail.comments) {
        output += `\n   💬 ${detail.comments}`;
      }
      output += `\n   📊 Evidence: ${detail.evidenceSummary.logsCount} logs, ${detail.evidenceSummary.toolCallsCount} tools, ${detail.evidenceSummary.screenshotsCount} screenshots`;
    }

    // Add recommendations
    output += `\n\n**Recommendations:**`;
    if (report.status.failed > 0) {
      output += `\n• Review failed tests and address underlying issues`;
    }
    if (report.status.skipped > 0) {
      output += `\n• Consider implementing skipped tests in future iterations`;
    }
    if (report.status.successRate < 90) {
      output += `\n• Success rate below 90% - review test stability and implementation`;
    }
    if (report.status.successRate >= 95) {
      output += `\n• Excellent success rate! System appears stable and well-tested`;
    }

    return output;
  }

  /**
   * Get all active agent sessions
   */
  getActiveAgents(): string[] {
    return Array.from(this.activeAgents);
  }

  /**
   * Cleanup completed agent sessions
   */
  async cleanupAgentSession(agentId: string): Promise<void> {
    this.runners.delete(agentId);
    this.activeAgents.delete(agentId);
    logger.info(`🧹 Cleaned up session for agent ${agentId}`);
  }

  // Private helper methods
  private getRunnerForAgent(agentId: string): ChecklistAgentRunner {
    const runner = this.runners.get(agentId);
    if (!runner) {
      throw new Error(`No active checklist session found for agent ${agentId}. Use 'initialize_agent_checklist' first.`);
    }
    return runner;
  }

  private async loadChecklistFromFile(checklistPath: string): Promise<TestChecklistItem[]> {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(checklistPath, 'utf-8');
      const data = JSON.parse(content);
      
      let items: any[];
      
      // Support both formats: structured (with metadata) and simple array
      if (data.metadata && data.items) {
        // Structured format with metadata
        items = data.items;
        logger.info(`📑 Loaded checklist: ${data.metadata.name} v${data.metadata.version}`);
      } else if (Array.isArray(data)) {
        // Simple array format (backward compatibility)
        items = data;
      } else {
        throw new Error('Checklist file must contain either an array of test items or an object with metadata and items');
      }
      
      // Validate checklist structure and map to expected format
      const mappedItems = items.map(item => {
        // Map field names from structured format to simple format if needed
        return {
          id: item.id,
          title: item.title,
          description: item.description,
          testInstructions: item.instructions || item.testInstructions,
          expectedOutcome: item.expectedOutcome,
          verificationCriteria: item.verificationCriteria || [],
          status: 'pending' as const,  // Status is managed by the runner
          estimatedDuration: item.estimatedDuration,
          difficulty: item.difficulty,
          dependencies: item.dependencies,
          tags: item.tags,
          metadata: item.metadata
        };
      });
      
      // Validate required fields
      for (const item of mappedItems) {
        if (!item.id || !item.title || !item.testInstructions) {
          throw new Error(`Invalid checklist item: missing required fields in ${item.id || 'unknown'}`);
        }
      }
      
      return mappedItems;
    } catch (error) {
      throw new Error(`Failed to load checklist from ${checklistPath}: ${error}`);
    }
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'skipped': return '⏭️';
      case 'in_progress': return '⏳';
      case 'pending': return '⏸️';
      default: return '❓';
    }
  }
}

// Global coordinator instance
export const checklistCoordinator = new AgentChecklistCoordinator();