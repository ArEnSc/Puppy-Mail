import { WorkflowPlan } from '../types/workflow'
import { WorkflowValidator } from './WorkflowValidator'
import { WorkflowStepBuilder } from './WorkflowStepBuilder'

/**
 * Helper for AI agents to create and validate workflows
 */
export class AgentWorkflowHelper {
  private builder = new WorkflowStepBuilder()

  /**
   * Create a workflow from natural language with validation
   */
  async createWorkflow(request: {
    description: string
    trigger: {
      type: 'email_from' | 'email_subject' | 'timer'
      config: Record<string, unknown>
    }
  }): Promise<{
    workflow?: WorkflowPlan
    errors?: string[]
    suggestions?: string[]
  }> {
    try {
      // Parse description into steps
      const steps = this.builder.parseNaturalLanguage(request.description)

      // Create workflow plan
      const workflow: WorkflowPlan = {
        id: `workflow-${Date.now()}`,
        name: this.extractWorkflowName(request.description),
        description: request.description,
        trigger: {
          id: `trigger-${Date.now()}`,
          type: request.trigger.type,
          config: request.trigger.config
        },
        steps,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Validate the workflow
      const validation = WorkflowValidator.validateWorkflow(workflow)

      if (!validation.valid) {
        const suggestions = WorkflowValidator.suggestFixes(validation.errors)
        return {
          errors: validation.errors.map((e) => e.message),
          suggestions
        }
      }

      // Add warnings if any
      if (validation.warnings.length > 0) {
        console.warn('Workflow warnings:', validation.warnings)
      }

      return { workflow }
    } catch (error) {
      return {
        errors: [`Failed to create workflow: ${error.message}`]
      }
    }
  }

  /**
   * Check if a step reference is valid
   */
  checkStepCompatibility(
    fromStep: { id: string; functionName: string },
    toStep: { functionName: string; inputField: string },
    referencePath: string
  ): {
    compatible: boolean
    reason?: string
    suggestion?: string
  } {
    // Get expected output from source step
    // const outputs = this.getStepOutputs(fromStep.functionName)

    // Check if path exists in outputs
    const pathParts = referencePath.split('.')
    if (pathParts[0] !== fromStep.id) {
      return {
        compatible: false,
        reason: `Reference must start with step ID "${fromStep.id}"`,
        suggestion: `Use "${fromStep.id}.data" or "${fromStep.id}.success"`
      }
    }

    // Check specific compatibility rules
    const compatibility = this.checkFieldCompatibility(
      fromStep.functionName,
      toStep.functionName,
      toStep.inputField,
      pathParts.slice(1).join('.')
    )

    return compatibility
  }

  /**
   * Get available references at a given point in the workflow
   */
  getAvailableReferences(
    workflow: WorkflowPlan,
    currentStepIndex: number
  ): {
    trigger: string[]
    steps: { [stepId: string]: string[] }
  } {
    const references = {
      trigger: [
        'trigger.emailId',
        'trigger.email',
        'trigger.email.from',
        'trigger.email.subject',
        'trigger.email.body'
      ],
      steps: {} as { [stepId: string]: string[] }
    }

    // Add references from previous steps
    for (let i = 0; i < currentStepIndex && i < workflow.steps.length; i++) {
      const step = workflow.steps[i]
      references.steps[step.id] = this.getStepOutputPaths(step.functionName, step.id)
    }

    return references
  }

  /**
   * Generate example usage for a function
   */
  getExampleUsage(functionName: string): Record<string, unknown> {
    const examples = {
      analysis: {
        basic: {
          prompt: 'Extract action items from this email',
          useTriggeredEmail: true
        },
        withPreviousEmails: {
          prompt: 'Summarize these emails',
          emailsFromPreviousStep: 'fetch-emails'
        }
      },
      sendEmail: {
        direct: {
          composition: {
            to: [{ email: 'user@example.com' }],
            subject: 'Notification',
            body: 'This is a notification message'
          }
        },
        fromAnalysis: {
          composition: {
            to: [{ email: 'user@example.com' }],
            subject: 'Analysis Results',
            body: { fromPreviousStep: 'analyze.data' }
          }
        }
      },
      addLabels: {
        toTriggerEmail: {
          operation: {
            emailIdFromPreviousStep: 'trigger',
            labelIds: ['processed', 'important'],
            operation: 'add'
          }
        }
      }
    }

    return examples[functionName] || {}
  }

  // Private helper methods

  private extractWorkflowName(description: string): string {
    // Simple extraction - could use NLP
    if (description.includes('when')) {
      const parts = description.split('when')
      return parts[0].trim() || 'Automated Workflow'
    }
    return description.substring(0, 50) + '...'
  }

  private getStepOutputs(functionName: string): Record<string, unknown> {
    const outputs = {
      analysis: {
        success: 'boolean',
        data: 'string | string[]'
      },
      sendEmail: {
        success: 'boolean',
        data: { messageId: 'string' }
      },
      addLabels: {
        success: 'boolean'
      },
      removeLabels: {
        success: 'boolean'
      },
      scheduleEmail: {
        success: 'boolean',
        data: { scheduledId: 'string' }
      },
      listenForEmails: {
        success: 'boolean',
        data: { listenerId: 'string' }
      }
    }

    return outputs[functionName] || { success: 'boolean' }
  }

  private getStepOutputPaths(functionName: string, stepId: string): string[] {
    const base = [`${stepId}.success`]

    switch (functionName) {
      case 'analysis':
        base.push(`${stepId}.data`)
        break
      case 'sendEmail':
        base.push(`${stepId}.data`, `${stepId}.data.messageId`)
        break
      case 'scheduleEmail':
        base.push(`${stepId}.data`, `${stepId}.data.scheduledId`)
        break
      case 'listenForEmails':
        base.push(`${stepId}.data`, `${stepId}.data.listenerId`)
        break
    }

    return base
  }

  private checkFieldCompatibility(
    fromFunction: string,
    toFunction: string,
    inputField: string,
    outputPath: string
  ): { compatible: boolean; reason?: string; suggestion?: string } {
    // Specific compatibility rules
    if (toFunction === 'sendEmail' && inputField === 'body') {
      if (fromFunction === 'analysis' && outputPath === 'data') {
        return { compatible: true }
      }
      return {
        compatible: false,
        reason: 'sendEmail body expects string content',
        suggestion: 'Use analysis step output or provide body directly'
      }
    }

    if (toFunction === 'addLabels' && inputField === 'emailId') {
      if (outputPath === 'emailId' || outputPath === 'trigger') {
        return { compatible: true }
      }
      return {
        compatible: false,
        reason: 'addLabels needs an email ID',
        suggestion: 'Use "trigger" or reference a step that provides emailId'
      }
    }

    // Generic success check
    if (outputPath === 'success') {
      return { compatible: true }
    }

    return { compatible: true } // Default permissive
  }
}

// Example usage for AI agent
export const AGENT_EXAMPLE = `
// Agent receives user request:
"When I get an email from my boss, analyze it for urgent items and label it if urgent"

// Agent creates workflow:
const helper = new AgentWorkflowHelper()
const result = await helper.createWorkflow({
  description: "When I get an email from my boss, analyze it for urgent items and label it if urgent",
  trigger: {
    type: 'email_from',
    config: { fromAddress: 'boss@company.com' }
  }
})

if (result.errors) {
  console.log('Validation errors:', result.errors)
  console.log('Suggestions:', result.suggestions)
} else {
  console.log('Valid workflow created:', result.workflow)
}

// Agent can check what's available at each step:
const references = helper.getAvailableReferences(workflow, 2)
console.log('Available to reference:', references)

// Agent can check compatibility:
const compat = helper.checkStepCompatibility(
  { id: 'analyze', functionName: 'analysis' },
  { functionName: 'sendEmail', inputField: 'body' },
  'analyze.data'
)
console.log('Compatible?', compat.compatible)
`
