import { WorkflowStep } from '../types/workflow'

/**
 * Helper class for AI agents to build workflow steps
 */
export class WorkflowStepBuilder {
  private stepCounter = 0

  /**
   * Create an analysis step
   */
  createAnalysisStep(prompt: string, useTriggeredEmail = true): WorkflowStep {
    return {
      id: `analyze-${++this.stepCounter}`,
      functionName: 'analysis',
      inputs: {
        prompt,
        useTriggeredEmail
      }
    }
  }

  /**
   * Create a send email step
   */
  createSendEmailStep(
    to: string[],
    subject: string,
    body: string | { fromPreviousStep: string },
    condition?: { previousStep: string; checkSuccess?: boolean }
  ): WorkflowStep {
    const step: WorkflowStep = {
      id: `send-${++this.stepCounter}`,
      functionName: 'sendEmail',
      inputs: {
        composition:
          typeof body === 'string'
            ? {
                to: to.map((email) => ({ email })),
                subject,
                body,
                isHtml: false
              }
            : body
      }
    }

    if (condition) {
      step.condition = {
        type: 'previousStepOutput',
        field: `${condition.previousStep}.success`,
        operator: 'equals',
        value: true
      }
    }

    return step
  }

  /**
   * Create an add labels step
   */
  createAddLabelsStep(
    labels: string[],
    previousStepId?: string,
    condition?: { previousStep: string }
  ): WorkflowStep {
    const step: WorkflowStep = {
      id: `label-${++this.stepCounter}`,
      functionName: 'addLabels',
      inputs: {
        operation: {
          emailIdFromPreviousStep: previousStepId || 'trigger',
          labelIds: labels,
          operation: 'add'
        }
      }
    }

    if (condition) {
      step.condition = {
        type: 'previousStepOutput',
        field: `${condition.previousStep}.success`,
        operator: 'equals',
        value: true
      }
    }

    return step
  }

  /**
   * Create a conditional branch
   */
  createConditionalStep(
    step: WorkflowStep,
    conditionField: string,
    operator: 'equals' | 'contains' | 'exists',
    value?: unknown
  ): WorkflowStep {
    return {
      ...step,
      condition: {
        type: 'previousStepOutput',
        field: conditionField,
        operator,
        value
      }
    }
  }

  /**
   * Parse natural language into workflow steps
   */
  parseNaturalLanguage(description: string): WorkflowStep[] {
    const steps: WorkflowStep[] = []

    // Simple pattern matching for common requests
    if (description.includes('analyze') || description.includes('extract')) {
      const prompt = this.extractPrompt(description)
      steps.push(this.createAnalysisStep(prompt))
    }

    if (description.includes('label') || description.includes('tag')) {
      const labels = this.extractLabels(description)
      const previousStep = steps.length > 0 ? steps[steps.length - 1].id : undefined
      steps.push(this.createAddLabelsStep(labels, previousStep))
    }

    if (description.includes('send') || description.includes('notify')) {
      const emailDetails = this.extractEmailDetails()
      const previousStep = steps.length > 0 ? steps[steps.length - 1].id : undefined
      steps.push(
        this.createSendEmailStep(
          emailDetails.to,
          emailDetails.subject,
          emailDetails.body,
          previousStep ? { previousStep } : undefined
        )
      )
    }

    return steps
  }

  private extractPrompt(description: string): string {
    // Extract analysis prompt from description
    if (description.includes('action items')) {
      return 'Extract all action items from this email'
    }
    if (description.includes('summary')) {
      return 'Provide a brief summary of this email'
    }
    if (description.includes('sentiment')) {
      return 'Analyze the sentiment and tone of this email'
    }
    return 'Analyze this email and extract key information'
  }

  private extractLabels(description: string): string[] {
    const labels: string[] = []
    if (description.includes('important')) labels.push('important')
    if (description.includes('urgent')) labels.push('urgent')
    if (description.includes('action')) labels.push('action-required')
    if (description.includes('follow up')) labels.push('follow-up')
    return labels.length > 0 ? labels : ['processed']
  }

  private extractEmailDetails(): {
    to: string[]
    subject: string
    body: string | { fromPreviousStep: string }
  } {
    // Simple extraction - in real implementation, use NLP to parse description
    // For now, return defaults with reference to previous analysis step
    return {
      to: ['user@example.com'], // Would extract from description
      subject: 'Workflow Notification',
      body: { fromPreviousStep: `analyze-${this.stepCounter}.data` }
    }
  }
}
