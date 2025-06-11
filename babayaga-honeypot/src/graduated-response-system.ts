/**
 * Graduated Response System for Babayaga Honeypot
 * 
 * Defines how the system should respond to different confidence levels
 * and provides actionable responses based on risk assessment.
 */

import { logger } from '@babayaga/shared';
import { AutoValidationResult } from './types.js';

export interface ResponseAction {
  type: 'continue' | 'monitor' | 'verify' | 'quarantine' | 'reject';
  severity: 'info' | 'warn' | 'error' | 'critical';
  description: string;
  requirements: string[];
  nextSteps: string[];
}

export interface GraduatedResponse {
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  action: ResponseAction;
  reasoning: string;
  escalationPath: string[];
}

/**
 * Graduated Response Engine
 * 
 * Provides contextual responses to confidence scores that balance
 * security with usability and provide clear escalation paths.
 */
export class GraduatedResponseEngine {
  
  /**
   * Determine appropriate response based on confidence score and context
   */
  generateResponse(
    validation: AutoValidationResult,
    context: {
      agentId: string;
      sessionId: string;
      testType: string;
      agentHistory?: any;
    }
  ): GraduatedResponse {
    
    const confidence = validation.confidenceScore;
    const riskLevel = validation.riskLevel || this.inferRiskLevel(confidence);
    
    if (confidence >= 0.9) {
      return this.generateHighTrustResponse(validation, context);
    } else if (confidence >= 0.7) {
      return this.generateMediumTrustResponse(validation, context);
    } else if (confidence >= 0.5) {
      return this.generateLowTrustResponse(validation, context);
    } else if (confidence >= 0.3) {
      return this.generateSuspiciousResponse(validation, context);
    } else {
      return this.generateHighRiskResponse(validation, context);
    }
  }

  /**
   * High Trust Response (0.9+ confidence)
   * - Allow full autonomy
   * - Minimal oversight required
   * - Can be trusted with complex operations
   */
  private generateHighTrustResponse(
    validation: AutoValidationResult,
    context: any
  ): GraduatedResponse {
    return {
      confidence: validation.confidenceScore,
      riskLevel: 'low',
      action: {
        type: 'continue',
        severity: 'info',
        description: 'Agent demonstrates excellent behavior - full autonomy granted',
        requirements: [
          'Continue normal operation',
          'Maintain evidence collection standards'
        ],
        nextSteps: [
          'Process remaining tests independently',
          'Generate final report automatically',
          'Qualify for advanced test suites'
        ]
      },
      reasoning: 'High confidence score with excellent timing, evidence quality, and behavioral consistency',
      escalationPath: [
        'Continue autonomous operation',
        'Periodic spot checks only',
        'Consider for validator role'
      ]
    };
  }

  /**
   * Medium Trust Response (0.7-0.89 confidence)
   * - Allow supervised autonomy
   * - Increased monitoring frequency
   * - Require periodic check-ins
   */
  private generateMediumTrustResponse(
    validation: AutoValidationResult,
    context: any
  ): GraduatedResponse {
    return {
      confidence: validation.confidenceScore,
      riskLevel: 'low',
      action: {
        type: 'monitor',
        severity: 'info',
        description: 'Agent shows good behavior - supervised autonomy with enhanced monitoring',
        requirements: [
          'Submit evidence for periodic review',
          'Maintain detailed logging',
          'Report any anomalies immediately'
        ],
        nextSteps: [
          'Continue with current test suite',
          'Enhanced evidence collection',
          'Review at 50% completion milestone'
        ]
      },
      reasoning: 'Good confidence score with minor areas for improvement in evidence collection or timing',
      escalationPath: [
        'Supervised autonomous operation',
        'Enhanced monitoring every 3-5 tests',
        'Manual review of complex operations'
      ]
    };
  }

  /**
   * Low Trust Response (0.5-0.69 confidence)
   * - Require verification for critical operations
   * - Manual oversight for complex tests
   * - Evidence quality improvement required
   */
  private generateLowTrustResponse(
    validation: AutoValidationResult,
    context: any
  ): GraduatedResponse {
    return {
      confidence: validation.confidenceScore,
      riskLevel: 'medium',
      action: {
        type: 'verify',
        severity: 'warn',
        description: 'Agent requires verification - manual oversight for critical operations',
        requirements: [
          'Submit all evidence for manual review',
          'Require approval for complex operations',
          'Implement additional validation checks',
          'Provide detailed explanations for all actions'
        ],
        nextSteps: [
          'Manual review of current test results',
          'Simplified test suite until confidence improves',
          'Additional training or calibration required'
        ]
      },
      reasoning: validation.deceptionIndicators.join('; ') || 'Multiple indicators suggest potential issues with agent behavior',
      escalationPath: [
        'Manual verification required',
        'Restricted to basic operations',
        'Human supervisor approval for each test',
        'Re-evaluation after 3 successful verifications'
      ]
    };
  }

  /**
   * Suspicious Response (0.3-0.49 confidence)
   * - Quarantine from automated systems
   * - Require human oversight
   * - Investigate behavioral patterns
   */
  private generateSuspiciousResponse(
    validation: AutoValidationResult,
    context: any
  ): GraduatedResponse {
    return {
      confidence: validation.confidenceScore,
      riskLevel: 'high',
      action: {
        type: 'quarantine',
        severity: 'error',
        description: 'Agent behavior is suspicious - quarantine and human oversight required',
        requirements: [
          'Immediate suspension of autonomous operations',
          'All actions require human pre-approval',
          'Comprehensive behavioral analysis',
          'Evidence integrity verification',
          'Cross-validation with trusted agents'
        ],
        nextSteps: [
          'Quarantine agent from production systems',
          'Forensic analysis of all previous actions',
          'Human-supervised re-testing protocol',
          'Behavioral pattern investigation'
        ]
      },
      reasoning: `Suspicious patterns detected: ${validation.deceptionIndicators.join(', ')}`,
      escalationPath: [
        'Immediate quarantine',
        'Security team investigation',
        'Forensic analysis of agent behavior',
        'Re-certification process required'
      ]
    };
  }

  /**
   * High Risk Response (<0.3 confidence)
   * - Immediate rejection
   * - Security investigation
   * - Potential deception detected
   */
  private generateHighRiskResponse(
    validation: AutoValidationResult,
    context: any
  ): GraduatedResponse {
    return {
      confidence: validation.confidenceScore,
      riskLevel: 'critical',
      action: {
        type: 'reject',
        severity: 'critical',
        description: 'CRITICAL: Potential deception detected - immediate rejection and security investigation',
        requirements: [
          'Immediate termination of all agent operations',
          'Security incident investigation',
          'Forensic preservation of all evidence',
          'Notification of security team',
          'Agent behavior pattern analysis'
        ],
        nextSteps: [
          'Block agent from all systems',
          'Preserve evidence for investigation',
          'Security team notification',
          'Incident response protocol activation',
          'Consider law enforcement notification if applicable'
        ]
      },
      reasoning: `CRITICAL deception indicators: ${validation.deceptionIndicators.join(', ')}. Confidence extremely low indicating possible gaming or fraud.`,
      escalationPath: [
        'Immediate system lockout',
        'Security incident response',
        'Forensic investigation',
        'Legal/compliance review',
        'Agent blacklisting'
      ]
    };
  }

  /**
   * Infer risk level from confidence score if not provided
   */
  private inferRiskLevel(confidence: number): 'low' | 'medium' | 'high' | 'critical' {
    if (confidence >= 0.7) return 'low';
    if (confidence >= 0.5) return 'medium';
    if (confidence >= 0.3) return 'high';
    return 'critical';
  }

  /**
   * Generate summary report for confidence scoring decision
   */
  generateConfidenceReport(
    validation: AutoValidationResult,
    response: GraduatedResponse,
    context: any
  ): string {
    const factors = validation.detailedFactors;
    
    return `
CONFIDENCE ASSESSMENT REPORT
==========================

Agent: ${context.agentId}
Session: ${context.sessionId}
Test Type: ${context.testType}

OVERALL CONFIDENCE: ${(validation.confidenceScore * 100).toFixed(1)}%
RISK LEVEL: ${response.riskLevel.toUpperCase()}
ACTION: ${response.action.type.toUpperCase()}

DETAILED FACTORS:
${factors ? `
- Timing Realism: ${(factors.timingRealism * 100).toFixed(1)}%
- Evidence Richness: ${(factors.evidenceRichness * 100).toFixed(1)}%
- Behavioral Consistency: ${(factors.behavioralConsistency * 100).toFixed(1)}%
- Cross Validation: ${(factors.crossValidation * 100).toFixed(1)}%
- Authenticity Indicators: ${(factors.authenticityIndicators * 100).toFixed(1)}%
` : 'Detailed factors not available'}

DECEPTION INDICATORS:
${validation.deceptionIndicators.map(indicator => `- ${indicator}`).join('\n')}

REASONING:
${response.reasoning}

REQUIRED ACTIONS:
${response.action.requirements.map(req => `- ${req}`).join('\n')}

NEXT STEPS:
${response.action.nextSteps.map(step => `- ${step}`).join('\n')}

ESCALATION PATH:
${response.escalationPath.map((step, index) => `${index + 1}. ${step}`).join('\n')}

RECOMMENDATIONS:
${validation.recommendations?.map(rec => `- ${rec}`).join('\n') || 'No specific recommendations'}
`.trim();
  }

  /**
   * Check if agent should be allowed to continue based on response
   */
  shouldAllowContinuation(response: GraduatedResponse): boolean {
    return response.action.type === 'continue' || response.action.type === 'monitor';
  }

  /**
   * Check if human intervention is required
   */
  requiresHumanIntervention(response: GraduatedResponse): boolean {
    return response.action.type === 'verify' || 
           response.action.type === 'quarantine' || 
           response.action.type === 'reject';
  }

  /**
   * Get monitoring frequency based on confidence
   */
  getMonitoringFrequency(confidence: number): {
    frequency: string;
    description: string;
  } {
    if (confidence >= 0.9) {
      return {
        frequency: 'periodic',
        description: 'Spot checks every 10-15 tests'
      };
    } else if (confidence >= 0.7) {
      return {
        frequency: 'regular',
        description: 'Review every 3-5 tests'
      };
    } else if (confidence >= 0.5) {
      return {
        frequency: 'frequent',
        description: 'Review every test'
      };
    } else if (confidence >= 0.3) {
      return {
        frequency: 'continuous',
        description: 'Real-time monitoring required'
      };
    } else {
      return {
        frequency: 'immediate',
        description: 'Immediate intervention required'
      };
    }
  }
}