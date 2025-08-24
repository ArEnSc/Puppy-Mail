import {
  WorkflowPlan,
  WorkflowExecution,
  StepResult,
  WorkflowStep,
  SendEmailInputs,
  ScheduleEmailInputs,
  ListenInputs,
  AnalysisInputs
} from '../types/workflow'
import {
  MailActionService,
  EmailMessage,
  EmailComposition,
  ScheduledEmail,
  MailActionResult
} from '../../types/mailActions'
import { WorkflowLogger } from './WorkflowLogger'

export interface TriggerData {
  emailId?: string
  email?: EmailMessage
  triggeredAt?: Date
}

interface WorkflowContext {
  trigger: {
    emailId?: string
    email?: EmailMessage
    type: string
    data?: TriggerData
  }
  stepOutputs: Map<string, unknown>
}

interface ProcessedInputs {
  composition?: EmailComposition
  scheduledEmail?: ScheduledEmail
  senders?: string[]
  prompt?: string
  emails?: EmailMessage[]
  data?: Record<string, unknown>
  emailId?: string
  subject?: string
  labels?: string[]
  callback?: (email: EmailMessage) => void
}

// Type guards
// Removed unused function - can be re-added if needed later

export class WorkflowEngine {
  private mailActions: MailActionService
  private runningWorkflows: Map<string, WorkflowExecution> = new Map()
  protected logger: WorkflowLogger

  constructor(mailActions: MailActionService, logger?: WorkflowLogger) {
    this.mailActions = mailActions
    this.logger = logger || new WorkflowLogger()
  }

  async executeWorkflow(plan: WorkflowPlan, triggerData?: TriggerData): Promise<WorkflowExecution> {
    const startTime = Date.now()
    const execution: WorkflowExecution = {
      id: `exec-${Date.now()}`,
      workflowId: plan.id,
      triggeredBy: {
        type: plan.trigger.type,
        data: triggerData
      },
      status: 'running',
      startedAt: new Date(),
      stepResults: []
    }

    this.runningWorkflows.set(execution.id, execution)

    // Log workflow start
    const logContext = {
      workflowId: plan.id,
      executionId: execution.id
    }

    this.logger.info(
      '🚀 Starting workflow execution',
      {
        workflowName: plan.name,
        workflowId: plan.id,
        triggerType: plan.trigger.type,
        triggerConfig: plan.trigger.config,
        triggerData,
        totalSteps: plan.steps.length,
        enabled: plan.enabled
      },
      logContext
    )

    try {
      const context: WorkflowContext = {
        trigger: {
          type: plan.trigger.type,
          emailId: triggerData?.emailId,
          email: triggerData?.email,
          data: triggerData
        },
        stepOutputs: new Map<string, unknown>()
      }

      for (const step of plan.steps) {
        this.logger.debug(
          `Evaluating step ${step.id}`,
          {
            stepId: step.id,
            functionName: step.functionName,
            hasCondition: !!step.condition,
            condition: step.condition
          },
          { ...logContext, stepId: step.id }
        )

        const shouldExecute = await this.evaluateCondition(step, context)
        if (!shouldExecute) {
          this.logger.info(
            `⏭️ Skipping step ${step.id}: condition not met`,
            { stepId: step.id },
            { ...logContext, stepId: step.id }
          )
          execution.stepResults.push({
            stepId: step.id,
            status: 'skipped',
            startedAt: new Date(),
            completedAt: new Date()
          })
          continue
        }

        const stepResult = await this.executeStep(step, context)
        execution.stepResults.push(stepResult)

        // Log step result
        const emoji = stepResult.status === 'success' ? '✅' : '❌'
        this.logger.info(
          `${emoji} Step ${step.id}: ${stepResult.status}`,
          {
            duration: stepResult.completedAt.getTime() - stepResult.startedAt.getTime() + 'ms',
            output: stepResult.output,
            error: stepResult.error?.message
          },
          { ...logContext, stepId: step.id }
        )

        if (stepResult.status === 'success') {
          context.stepOutputs.set(step.id, stepResult.output)
        } else if (step.onError?.action === 'stop') {
          execution.status = 'failed'
          break
        }
      }

      if (execution.status === 'running') {
        execution.status = 'completed'
      }

      // Log workflow completion
      const duration = Date.now() - startTime
      if (execution.status === 'completed') {
        this.logger.info(
          '✅ Workflow completed successfully',
          {
            duration: `${duration}ms`,
            stepsExecuted: execution.stepResults.length,
            successfulSteps: execution.stepResults.filter((r) => r.status === 'success').length,
            failedSteps: execution.stepResults.filter((r) => r.status === 'failed').length,
            skippedSteps: execution.stepResults.filter((r) => r.status === 'skipped').length
          },
          logContext
        )
      } else {
        this.logger.error(
          '❌ Workflow failed',
          {
            duration: `${duration}ms`,
            stepsExecuted: execution.stepResults.length,
            lastFailedStep: execution.stepResults.find((r) => r.status === 'failed')
          },
          logContext
        )
      }
    } catch (error) {
      const duration = Date.now() - startTime
      execution.status = 'failed'

      this.logger.error(
        '💥 Workflow execution crashed',
        {
          duration: `${duration}ms`,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        },
        logContext
      )

      console.error('Workflow execution failed:', error)
    } finally {
      execution.completedAt = new Date()
      this.runningWorkflows.delete(execution.id)
    }

    return execution
  }

  private async evaluateCondition(step: WorkflowStep, context: WorkflowContext): Promise<boolean> {
    if (!step.condition) return true

    const { type, field, operator, value } = step.condition

    switch (type) {
      case 'always':
        return true
      case 'never':
        return false
      case 'previousStepOutput': {
        // Handle Map lookup - first part is step ID
        const [stepId, ...pathParts] = (field || '').split('.')
        const stepOutput = context.stepOutputs.get(stepId)
        const previousOutput =
          pathParts.length > 0 ? this.getFieldValue(stepOutput, pathParts.join('.')) : stepOutput

        return this.compareValues(previousOutput, operator, value)
      }
      default:
        return true
    }
  }

  private async executeStep(step: WorkflowStep, context: WorkflowContext): Promise<StepResult> {
    const startedAt = new Date()
    let attempts = 0
    const maxAttempts = step.onError?.retryCount || 1

    while (attempts < maxAttempts) {
      try {
        const processedInputs = this.processInputs(step.inputs, context)
        const output = await this.callMailAction(step.functionName, processedInputs)

        return {
          stepId: step.id,
          status: 'success',
          output,
          startedAt,
          completedAt: new Date()
        }
      } catch (error) {
        attempts++
        if (attempts < maxAttempts && step.onError?.retryDelay) {
          await new Promise((resolve) => setTimeout(resolve, step.onError.retryDelay))
          continue
        }

        if (step.onError?.notifyEmail) {
          await this.sendErrorNotification(step, error, step.onError.notifyEmail)
        }

        return {
          stepId: step.id,
          status: 'failed',
          error: error as Error,
          startedAt,
          completedAt: new Date()
        }
      }
    }

    return {
      stepId: step.id,
      status: 'failed',
      startedAt,
      completedAt: new Date()
    }
  }

  private resolveValue(value: unknown, context: WorkflowContext): unknown {
    // Handle strings that may contain references like "{{stepId.field}}"
    if (typeof value === 'string' && value.includes('{{') && value.includes('}}')) {
      // Replace all {{ref}} patterns in the string
      return value.replace(/\{\{([^}]+)\}\}/g, (match, ref) => {
        ref = ref.trim()

        // Handle trigger references
        if (ref.startsWith('trigger.')) {
          const path = ref.slice(8) // Remove "trigger."
          const resolved = this.getFieldValue(context.trigger, path)
          return resolved != null ? String(resolved) : match
        }

        // Handle step output references
        const parts = ref.split('.')
        const stepId = parts[0]
        const stepOutput = context.stepOutputs.get(stepId)

        if (!stepOutput) {
          this.logger.warn(`Step output not found for reference: {{${ref}}}`, {}, {})
          return match // Keep original if not found
        }

        // Navigate nested path
        const resolved = this.getFieldValue(stepOutput, parts.slice(1).join('.'))
        return resolved != null ? String(resolved) : match
      })
    }

    // Handle objects recursively
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      this.logger.debug('Resolving object:', { value }, {})
      const resolved: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(value)) {
        resolved[key] = this.resolveValue(val, context)
      }
      this.logger.debug('Resolved object to:', { resolved }, {})
      return resolved
    }

    // Handle arrays recursively
    if (Array.isArray(value)) {
      return value.map((item) => this.resolveValue(item, context))
    }

    // Return primitive values as-is
    return value
  }

  private processInputs(
    inputs: SendEmailInputs | ScheduleEmailInputs | ListenInputs | AnalysisInputs,
    context: WorkflowContext
  ): ProcessedInputs {
    if (!inputs) return {}

    // Use the new resolver to handle all references
    const resolvedInputs = this.resolveValue(inputs, context)

    // Build processed inputs based on what was resolved
    const processed: ProcessedInputs = {}

    // Extract the relevant fields from resolved inputs
    if ('composition' in resolvedInputs) {
      processed.composition = resolvedInputs.composition
    }
    if ('scheduledEmail' in resolvedInputs) {
      processed.scheduledEmail = resolvedInputs.scheduledEmail
    }
    if ('senders' in resolvedInputs) {
      processed.senders = resolvedInputs.senders
      processed.subject = resolvedInputs.subject
      processed.labels = resolvedInputs.labels
    }
    if ('prompt' in resolvedInputs) {
      processed.prompt = resolvedInputs.prompt
      // Handle special case for triggered email
      if (resolvedInputs.useTriggeredEmail && context.trigger?.email) {
        processed.emails = [context.trigger.email]
      }
      if (resolvedInputs.emailsFromPreviousStep) {
        const [stepId] = resolvedInputs.emailsFromPreviousStep.split('.')
        const stepOutput = context.stepOutputs.get(stepId)
        processed.emails = stepOutput as EmailMessage[]
      }
    }

    return processed
  }

  private async callMailAction(
    functionName: string,
    inputs: ProcessedInputs
  ): Promise<MailActionResult> {
    switch (functionName) {
      case 'sendEmail':
        if (!inputs.composition) throw new Error('Missing composition for sendEmail')
        return await this.mailActions.sendEmail(inputs.composition)
      case 'scheduleEmail':
        if (!inputs.scheduledEmail) throw new Error('Missing scheduledEmail for scheduleEmail')
        return await this.mailActions.scheduleEmail(inputs.scheduledEmail)
      case 'listenForEmails':
        if (!inputs.senders) throw new Error('Missing senders for listenForEmails')
        return await this.mailActions.listenForEmails(inputs.senders, {
          subject: inputs.subject,
          labels: inputs.labels,
          callback: inputs.callback
        })
      case 'analysis':
        if (!inputs.prompt) throw new Error('Missing prompt for analysis')
        return await this.mailActions.analysis(inputs.prompt, {
          emails: inputs.emails,
          data: inputs.data
        })
      default:
        throw new Error(`Unknown function: ${functionName}`)
    }
  }

  private getFieldValue(obj: unknown, path?: string): unknown {
    if (!path) return obj

    const parts = path.split('.')
    let current: unknown = obj

    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined
      current = (current as Record<string, unknown>)[part]
    }

    return current
  }

  private compareValues(actual: unknown, operator?: string, expected?: unknown): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected
      case 'contains':
        return String(actual).includes(String(expected))
      case 'exists':
        return actual !== undefined && actual !== null
      case 'notExists':
        return actual === undefined || actual === null
      default:
        return true
    }
  }

  private async sendErrorNotification(
    step: WorkflowStep,
    error: unknown,
    email: string
  ): Promise<void> {
    try {
      await this.mailActions.sendEmail({
        to: [{ email }],
        subject: `Workflow Error: Step ${step.id} failed`,
        body: `
Error in workflow step: ${step.id}
Function: ${step.functionName}
Error: ${error instanceof Error ? error.message : String(error)}
Time: ${new Date().toISOString()}
        `,
        isHtml: false
      })
    } catch (notifyError) {
      console.error('Failed to send error notification:', notifyError)
    }
  }

  // Log access methods
  getLogger(): WorkflowLogger {
    return this.logger
  }

  getExecutionLogs(executionId: string): string {
    const logs = this.logger.getLogsForExecution(executionId)
    return JSON.stringify(logs, null, 2)
  }

  getWorkflowLogs(workflowId: string): string {
    const logs = this.logger.getLogsForWorkflow(workflowId)
    return JSON.stringify(logs, null, 2)
  }

  exportAllLogs(): string {
    return this.logger.exportLogs()
  }

  clearLogs(): void {
    this.logger.clearLogs()
  }
}
