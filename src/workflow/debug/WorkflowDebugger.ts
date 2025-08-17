import { WorkflowPlan, WorkflowExecution } from '../types/workflow'
import { TriggerData } from '../engine/WorkflowEngine'

export class WorkflowDebugger {
  /**
   * Generate a visual representation of the workflow
   */
  static visualizeWorkflow(plan: WorkflowPlan): string {
    const lines: string[] = []

    lines.push('📋 Workflow: ' + plan.name)
    lines.push('━'.repeat(50))
    lines.push(`ID: ${plan.id}`)
    lines.push(`Enabled: ${plan.enabled ? '✅' : '❌'}`)
    lines.push('')

    // Trigger
    lines.push('🎯 Trigger:')
    lines.push(`  Type: ${plan.trigger.type}`)
    lines.push(`  Config: ${JSON.stringify(plan.trigger.config, null, 2).split('\n').join('\n  ')}`)
    lines.push('')

    // Steps
    lines.push('📝 Steps:')
    plan.steps.forEach((step, index) => {
      lines.push(`${index + 1}. ${step.id} [${step.functionName}]`)

      if (step.condition) {
        lines.push(`   ├─ Condition: ${step.condition.type}`)
        if (step.condition.field) {
          lines.push(
            `   │  └─ Check: ${step.condition.field} ${step.condition.operator} ${step.condition.value}`
          )
        }
      }

      lines.push(`   ├─ Inputs: ${JSON.stringify(step.inputs).substring(0, 50)}...`)

      if (step.onError) {
        lines.push(`   └─ On Error: ${step.onError.action}`)
        if (step.onError.retryCount) {
          lines.push(`      └─ Retry: ${step.onError.retryCount} times`)
        }
      }

      if (index < plan.steps.length - 1) {
        lines.push('   ↓')
      }
    })

    return lines.join('\n')
  }

  /**
   * Generate execution trace for debugging
   */
  static generateExecutionTrace(execution: WorkflowExecution): string {
    const lines: string[] = []

    lines.push('🔍 Execution Trace')
    lines.push('━'.repeat(50))
    lines.push(`Execution ID: ${execution.id}`)
    lines.push(`Workflow ID: ${execution.workflowId}`)
    lines.push(
      `Status: ${execution.status === 'completed' ? '✅' : execution.status === 'failed' ? '❌' : '🔄'} ${execution.status}`
    )
    lines.push(`Started: ${execution.startedAt.toISOString()}`)
    if (execution.completedAt) {
      lines.push(`Completed: ${execution.completedAt.toISOString()}`)
      lines.push(`Duration: ${execution.completedAt.getTime() - execution.startedAt.getTime()}ms`)
    }
    lines.push('')

    lines.push('Trigger:')
    lines.push(`  Type: ${execution.triggeredBy.type}`)
    if (execution.triggeredBy.data) {
      lines.push(
        `  Data: ${JSON.stringify(execution.triggeredBy.data, null, 2).split('\n').join('\n  ')}`
      )
    }
    lines.push('')

    lines.push('Step Results:')
    execution.stepResults.forEach((result, index) => {
      const statusEmoji =
        result.status === 'success' ? '✅' : result.status === 'failed' ? '❌' : '⏭️'
      lines.push(`${index + 1}. ${statusEmoji} ${result.stepId}`)
      lines.push(`   Status: ${result.status}`)
      lines.push(`   Duration: ${result.completedAt.getTime() - result.startedAt.getTime()}ms`)

      if (result.output) {
        lines.push(`   Output: ${JSON.stringify(result.output).substring(0, 100)}...`)
      }

      if (result.error) {
        lines.push(`   Error: ${result.error.message}`)
      }

      if (index < execution.stepResults.length - 1) {
        lines.push('')
      }
    })

    return lines.join('\n')
  }

  /**
   * Create a debug context for testing
   */
  static createDebugContext(triggerData?: TriggerData): {
    trigger: TriggerData
    stepOutputs: Map<string, unknown>
  } {
    return {
      trigger: triggerData || {},
      stepOutputs: new Map([
        ['mock-step-1', { success: true, data: 'mock output 1' }],
        ['mock-step-2', { success: true, data: 'mock output 2' }]
      ])
    }
  }

  /**
   * Validate workflow configuration
   */
  static validateWorkflow(plan: WorkflowPlan): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check basic structure
    if (!plan.id) errors.push('Workflow must have an ID')
    if (!plan.name) errors.push('Workflow must have a name')
    if (!plan.trigger) errors.push('Workflow must have a trigger')
    if (!plan.steps || plan.steps.length === 0) errors.push('Workflow must have at least one step')

    // Validate trigger
    if (plan.trigger) {
      if (!plan.trigger.type) errors.push('Trigger must have a type')
      if (!plan.trigger.config) errors.push('Trigger must have configuration')
    }

    // Validate steps
    plan.steps?.forEach((step, index) => {
      if (!step.id) errors.push(`Step ${index + 1} must have an ID`)
      if (!step.functionName) errors.push(`Step ${index + 1} must have a function name`)
      if (!step.inputs) errors.push(`Step ${index + 1} must have inputs`)

      // Validate step references
      if (step.onError?.fallbackStepId) {
        const fallbackExists = plan.steps.some((s) => s.id === step.onError?.fallbackStepId)
        if (!fallbackExists) {
          errors.push(
            `Step ${step.id} references non-existent fallback step: ${step.onError.fallbackStepId}`
          )
        }
      }
    })

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Generate test data for workflow
   */
  static generateTestData(plan: WorkflowPlan): {
    triggerData: TriggerData
    description: string
  } {
    switch (plan.trigger.type) {
      case 'email_from':
        return {
          triggerData: {
            emailId: 'test-email-123',
            email: {
              id: 'test-email-123',
              from: {
                email: (plan.trigger.config as Record<string, unknown>).fromAddress as string
              },
              to: [{ email: 'test@example.com' }],
              subject: 'Test Email',
              body: 'This is a test email for workflow debugging',
              date: new Date(),
              labels: ['inbox'],
              isRead: false,
              hasAttachment: false
            }
          },
          description: `Email from ${(plan.trigger.config as Record<string, unknown>).fromAddress}`
        }

      case 'email_subject':
        return {
          triggerData: {
            emailId: 'test-email-456',
            email: {
              id: 'test-email-456',
              from: { email: 'sender@example.com' },
              to: [{ email: 'test@example.com' }],
              subject: `Test: ${(plan.trigger.config as Record<string, unknown>).subject}`,
              body: 'This is a test email for workflow debugging',
              date: new Date(),
              labels: ['inbox'],
              isRead: false,
              hasAttachment: false
            }
          },
          description: `Email with subject containing "${(plan.trigger.config as Record<string, unknown>).subject}"`
        }

      case 'timer':
        return {
          triggerData: {
            triggeredAt: new Date()
          },
          description: 'Timer trigger'
        }

      default:
        return {
          triggerData: {},
          description: 'Unknown trigger type'
        }
    }
  }
}
