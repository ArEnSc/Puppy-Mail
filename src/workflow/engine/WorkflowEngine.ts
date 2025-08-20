import {
  WorkflowPlan,
  WorkflowExecution,
  StepResult,
  WorkflowStep,
  SendEmailInputs,
  ScheduleEmailInputs,
  LabelInputs,
  ListenInputs,
  AnalysisInputs
} from '../types/workflow'
import {
  MailActionService,
  EmailMessage,
  EmailComposition,
  ScheduledEmail,
  LabelOperation,
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
  labelIds?: string[]
  operation?: 'add' | 'remove' | 'set'
  subject?: string
  labels?: string[]
  callback?: (email: EmailMessage) => void
}

// Type guards
function hasFromPreviousStep(obj: unknown): obj is { fromPreviousStep: string } {
  return typeof obj === 'object' && obj !== null && 'fromPreviousStep' in obj
}

function isLabelOperationWithRef(obj: unknown): obj is {
  emailIdFromPreviousStep?: string
  labelIds: string[]
  operation: 'add' | 'remove' | 'set'
} {
  return typeof obj === 'object' && obj !== null && 'operation' in obj && 'labelIds' in obj
}

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

  private processInputs(
    inputs: SendEmailInputs | ScheduleEmailInputs | LabelInputs | ListenInputs | AnalysisInputs,
    context: WorkflowContext
  ): ProcessedInputs {
    if (!inputs) return {}

    const processed: ProcessedInputs = {}

    // Type-safe input processing based on input type
    if ('composition' in inputs && inputs.composition) {
      if (hasFromPreviousStep(inputs.composition)) {
        const stepRef = inputs.composition.fromPreviousStep
        const [stepId, ...path] = stepRef.split('.')
        const stepOutput = context.stepOutputs.get(stepId)
        processed.composition = this.getFieldValue(
          { [stepId]: stepOutput },
          path.join('.')
        ) as EmailComposition
      } else {
        processed.composition = inputs.composition as EmailComposition
      }
    }

    if ('scheduledEmail' in inputs && inputs.scheduledEmail) {
      if (hasFromPreviousStep(inputs.scheduledEmail)) {
        const stepRef = inputs.scheduledEmail.fromPreviousStep
        const [stepId, ...path] = stepRef.split('.')
        const stepOutput = context.stepOutputs.get(stepId)
        processed.scheduledEmail = this.getFieldValue(
          { [stepId]: stepOutput },
          path.join('.')
        ) as ScheduledEmail
      } else {
        processed.scheduledEmail = inputs.scheduledEmail as ScheduledEmail
      }
    }

    if ('operation' in inputs) {
      const labelInputs = inputs as LabelInputs
      if (isLabelOperationWithRef(labelInputs.operation)) {
        processed.emailId = context.trigger?.emailId
        processed.labelIds = labelInputs.operation.labelIds
        processed.operation = labelInputs.operation.operation
      } else {
        const op = labelInputs.operation as LabelOperation
        processed.emailId = op.emailId
        processed.labelIds = op.labelIds
        processed.operation = op.operation
      }
    }

    if ('senders' in inputs) {
      const listenInputs = inputs as ListenInputs
      processed.senders = listenInputs.senders
      processed.subject = listenInputs.subject
      processed.labels = listenInputs.labels
    }

    if ('prompt' in inputs) {
      const analysisInputs = inputs as AnalysisInputs
      processed.prompt = analysisInputs.prompt
      if (analysisInputs.useTriggeredEmail && context.trigger?.email) {
        processed.emails = [context.trigger.email]
      }
      if (analysisInputs.emailsFromPreviousStep) {
        const [stepId] = analysisInputs.emailsFromPreviousStep.split('.')
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
      case 'addLabels':
        if (!inputs.emailId || !inputs.labelIds || !inputs.operation) {
          throw new Error('Missing required fields for addLabels')
        }
        return await this.mailActions.addLabels({
          emailId: inputs.emailId,
          labelIds: inputs.labelIds,
          operation: inputs.operation
        })
      case 'removeLabels':
        if (!inputs.emailId || !inputs.labelIds || !inputs.operation) {
          throw new Error('Missing required fields for removeLabels')
        }
        return await this.mailActions.removeLabels({
          emailId: inputs.emailId,
          labelIds: inputs.labelIds,
          operation: inputs.operation
        })
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
