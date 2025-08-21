import {
  WorkflowPlan,
  WorkflowStep,
  WorkflowFunction,
  SendEmailInputs,
  AnalysisInputs,
  LabelInputs,
  ScheduleEmailInputs,
  ListenInputs
} from '../types/workflow'
import { EmailComposition, ScheduledEmail } from '../../types/mailActions'

interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

interface ValidationError {
  stepId: string
  field: string
  message: string
  suggestion?: string
}

interface ValidationWarning {
  stepId: string
  message: string
}

interface StepOutput {
  success: boolean
  data?: unknown
  // Specific outputs by function
  messageId?: string // sendEmail
  scheduledId?: string // scheduleEmail
  listenerId?: string // listenForEmails
}

/**
 * Validates workflow compatibility and data flow
 */
export class WorkflowValidator {
  // Define what each function outputs
  private static readonly FUNCTION_OUTPUTS: Record<
    WorkflowFunction,
    (inputs: unknown) => StepOutput
  > = {
    analysis: () => ({
      success: true,
      data: 'string or string[]' // Analysis results
    }),
    sendEmail: () => ({
      success: true,
      data: { messageId: 'string' }
    }),
    scheduleEmail: () => ({
      success: true,
      data: { scheduledId: 'string' }
    }),
    addLabels: () => ({
      success: true
      // No data field
    }),
    removeLabels: () => ({
      success: true
      // No data field
    }),
    listenForEmails: () => ({
      success: true,
      data: { listenerId: 'string' }
    })
  }

  /**
   * Validate entire workflow
   */
  static validateWorkflow(plan: WorkflowPlan): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Track available outputs
    const availableOutputs = new Map<string, StepOutput>()

    // Trigger data is always available
    availableOutputs.set('trigger', {
      success: true,
      data: {
        emailId: 'string',
        email: 'EmailMessage object'
      }
    })

    // Validate each step
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i]
      const stepErrors = this.validateStep(step, availableOutputs)
      errors.push(...stepErrors)

      // Add this step's output to available outputs
      const output = this.FUNCTION_OUTPUTS[step.functionName]({})
      availableOutputs.set(step.id, output)

      // Check for unused outputs (warning)
      if (i === plan.steps.length - 1) {
        // Last step
        if (step.functionName === 'analysis') {
          warnings.push({
            stepId: step.id,
            message: 'Analysis output is not used by any subsequent steps'
          })
        }
      }
    }

    // Check for duplicate step IDs
    const stepIds = plan.steps.map((s) => s.id)
    const duplicates = stepIds.filter((id, index) => stepIds.indexOf(id) !== index)
    duplicates.forEach((id) => {
      errors.push({
        stepId: id,
        field: 'id',
        message: `Duplicate step ID: ${id}`
      })
    })

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate a single step
   */
  private static validateStep(
    step: WorkflowStep,
    availableOutputs: Map<string, StepOutput>
  ): ValidationError[] {
    const errors: ValidationError[] = []

    // Validate condition if present
    if (step.condition) {
      const conditionErrors = this.validateCondition(step, availableOutputs)
      errors.push(...conditionErrors)
    }

    // Validate inputs based on function type
    switch (step.functionName) {
      case 'analysis':
        errors.push(...this.validateAnalysisInputs(step, availableOutputs))
        break
      case 'sendEmail':
        errors.push(...this.validateSendEmailInputs(step, availableOutputs))
        break
      case 'addLabels':
      case 'removeLabels':
        errors.push(...this.validateLabelInputs(step, availableOutputs))
        break
      case 'scheduleEmail':
        errors.push(...this.validateScheduleEmailInputs(step, availableOutputs))
        break
      case 'listenForEmails':
        errors.push(...this.validateListenInputs(step))
        break
    }

    return errors
  }

  /**
   * Validate condition references
   */
  private static validateCondition(
    step: WorkflowStep,
    availableOutputs: Map<string, StepOutput>
  ): ValidationError[] {
    const errors: ValidationError[] = []

    if (!step.condition) return errors

    if (step.condition.type === 'previousStepOutput' && step.condition.field) {
      const [stepId, ...pathParts] = step.condition.field.split('.')

      if (!availableOutputs.has(stepId)) {
        errors.push({
          stepId: step.id,
          field: 'condition.field',
          message: `Referenced step "${stepId}" not found or not yet executed`,
          suggestion: `Available steps: ${Array.from(availableOutputs.keys()).join(', ')}`
        })
      } else {
        // Validate the path exists in output
        const output = availableOutputs.get(stepId)!
        if (pathParts.length > 0) {
          const path = pathParts.join('.')
          if (!this.pathExistsInOutput(output, path)) {
            errors.push({
              stepId: step.id,
              field: 'condition.field',
              message: `Path "${path}" does not exist in step "${stepId}" output`,
              suggestion: `Available fields: ${this.getAvailableFields(output)}`
            })
          }
        }
      }
    }

    return errors
  }

  /**
   * Validate analysis inputs
   */
  private static validateAnalysisInputs(
    step: WorkflowStep,
    availableOutputs: Map<string, StepOutput>
  ): ValidationError[] {
    const errors: ValidationError[] = []
    const inputs = step.inputs as AnalysisInputs

    if (!inputs.prompt) {
      errors.push({
        stepId: step.id,
        field: 'inputs.prompt',
        message: 'Analysis requires a prompt'
      })
    }

    if (inputs.emailsFromPreviousStep) {
      const [stepId] = inputs.emailsFromPreviousStep.split('.')
      if (!availableOutputs.has(stepId)) {
        errors.push({
          stepId: step.id,
          field: 'inputs.emailsFromPreviousStep',
          message: `Referenced step "${stepId}" not found`,
          suggestion: `Available steps: ${Array.from(availableOutputs.keys()).join(', ')}`
        })
      }
    }

    return errors
  }

  /**
   * Validate sendEmail inputs
   */
  private static validateSendEmailInputs(
    step: WorkflowStep,
    availableOutputs: Map<string, StepOutput>
  ): ValidationError[] {
    const errors: ValidationError[] = []
    const inputs = step.inputs as SendEmailInputs

    if (!inputs.composition) {
      errors.push({
        stepId: step.id,
        field: 'inputs.composition',
        message: 'sendEmail requires composition'
      })
      return errors
    }

    // Check if using fromPreviousStep
    if ('fromPreviousStep' in inputs.composition && inputs.composition.fromPreviousStep) {
      const [stepId, ...path] = inputs.composition.fromPreviousStep.split('.')
      if (!availableOutputs.has(stepId)) {
        errors.push({
          stepId: step.id,
          field: 'inputs.composition.fromPreviousStep',
          message: `Referenced step "${stepId}" not found`,
          suggestion: `Available steps: ${Array.from(availableOutputs.keys()).join(', ')}`
        })
      } else {
        // Check if the referenced step produces compatible data
        // Validate that output exists (for type checking)
        availableOutputs.get(stepId)!
        if (stepId !== 'analysis' && !path.includes('data')) {
          errors.push({
            stepId: step.id,
            field: 'inputs.composition.fromPreviousStep',
            message: `Step "${stepId}" may not produce email composition data`,
            suggestion: 'Use analysis step output or provide composition directly'
          })
        }
      }
    } else {
      // Validate direct composition
      const comp = inputs.composition as EmailComposition
      if (!comp.to || comp.to.length === 0) {
        errors.push({
          stepId: step.id,
          field: 'inputs.composition.to',
          message: 'Email composition requires at least one recipient'
        })
      }
      if (!comp.subject) {
        errors.push({
          stepId: step.id,
          field: 'inputs.composition.subject',
          message: 'Email composition requires a subject'
        })
      }
      if (!comp.body) {
        errors.push({
          stepId: step.id,
          field: 'inputs.composition.body',
          message: 'Email composition requires a body'
        })
      }
    }

    return errors
  }

  /**
   * Validate label operation inputs
   */
  private static validateLabelInputs(
    step: WorkflowStep,
    availableOutputs: Map<string, StepOutput>
  ): ValidationError[] {
    const errors: ValidationError[] = []
    const inputs = step.inputs as LabelInputs

    if (!inputs.operation) {
      errors.push({
        stepId: step.id,
        field: 'inputs.operation',
        message: 'Label operation requires operation details'
      })
      return errors
    }

    const op = inputs.operation

    // Check if it's the extended operation type with emailIdFromPreviousStep
    if ('emailIdFromPreviousStep' in op) {
      if (op.emailIdFromPreviousStep && op.emailIdFromPreviousStep !== 'trigger') {
        const stepId = op.emailIdFromPreviousStep
        if (!availableOutputs.has(stepId)) {
          errors.push({
            stepId: step.id,
            field: 'inputs.operation.emailIdFromPreviousStep',
            message: `Referenced step "${stepId}" not found`,
            suggestion: 'Use "trigger" or a valid step ID'
          })
        }
      } else if (!op.emailId && !op.emailIdFromPreviousStep) {
        errors.push({
          stepId: step.id,
          field: 'inputs.operation',
          message: 'Label operation requires emailId or emailIdFromPreviousStep'
        })
      }
    } else {
      // It's a regular LabelOperation, must have emailId
      if (!op.emailId) {
        errors.push({
          stepId: step.id,
          field: 'inputs.operation.emailId',
          message: 'Label operation requires emailId'
        })
      }
    }

    if (!op.labelIds || op.labelIds.length === 0) {
      errors.push({
        stepId: step.id,
        field: 'inputs.operation.labelIds',
        message: 'Label operation requires at least one label'
      })
    }

    if (!op.operation || !['add', 'remove', 'set'].includes(op.operation)) {
      errors.push({
        stepId: step.id,
        field: 'inputs.operation.operation',
        message: 'Label operation must be "add", "remove", or "set"'
      })
    }

    return errors
  }

  /**
   * Validate scheduleEmail inputs
   */
  private static validateScheduleEmailInputs(
    step: WorkflowStep,
    availableOutputs: Map<string, StepOutput>
  ): ValidationError[] {
    const errors: ValidationError[] = []
    const inputs = step.inputs as ScheduleEmailInputs

    if (!inputs.scheduledEmail) {
      errors.push({
        stepId: step.id,
        field: 'inputs.scheduledEmail',
        message: 'scheduleEmail requires scheduledEmail details'
      })
      return errors
    }

    // Similar validation to sendEmail but also check scheduledTime
    if ('fromPreviousStep' in inputs.scheduledEmail) {
      // Validate reference
      const ref = inputs.scheduledEmail.fromPreviousStep!
      const [stepId] = ref.split('.')
      if (!availableOutputs.has(stepId)) {
        errors.push({
          stepId: step.id,
          field: 'inputs.scheduledEmail.fromPreviousStep',
          message: `Referenced step "${stepId}" not found`
        })
      }
    } else {
      const scheduled = inputs.scheduledEmail as ScheduledEmail
      if (!scheduled.scheduledTime) {
        errors.push({
          stepId: step.id,
          field: 'inputs.scheduledEmail.scheduledTime',
          message: 'Scheduled email requires scheduledTime'
        })
      }
    }

    return errors
  }

  /**
   * Validate listenForEmails inputs
   */
  private static validateListenInputs(step: WorkflowStep): ValidationError[] {
    const errors: ValidationError[] = []
    const inputs = step.inputs as ListenInputs

    if (!inputs.senders || inputs.senders.length === 0) {
      errors.push({
        stepId: step.id,
        field: 'inputs.senders',
        message: 'listenForEmails requires at least one sender'
      })
    }

    return errors
  }

  /**
   * Check if a path exists in output structure
   */
  private static pathExistsInOutput(output: StepOutput, path: string): boolean {
    // For validation purposes, we accept common paths
    const validPaths = ['success', 'data', 'data.messageId', 'data.scheduledId', 'data.listenerId']
    return validPaths.includes(path)
  }

  /**
   * Get available fields from output
   */
  private static getAvailableFields(output: StepOutput): string {
    const fields = ['success']
    if (output.data !== undefined) {
      fields.push('data')
      if (typeof output.data === 'object' && output.data !== null) {
        const dataFields = Object.keys(output.data as Record<string, unknown>)
        dataFields.forEach((field) => fields.push(`data.${field}`))
      }
    }
    return fields.join(', ')
  }

  /**
   * Suggest fixes for common errors
   */
  static suggestFixes(errors: ValidationError[]): string[] {
    const suggestions: string[] = []

    errors.forEach((error) => {
      if (error.message.includes('not found')) {
        suggestions.push(`Ensure step "${error.stepId}" comes after the referenced step`)
      }
      if (error.message.includes('requires')) {
        suggestions.push(`Add missing field "${error.field}" to step "${error.stepId}"`)
      }
    })

    return Array.from(new Set(suggestions)) // Remove duplicates
  }
}
