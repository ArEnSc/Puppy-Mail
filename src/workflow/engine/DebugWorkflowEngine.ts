import { WorkflowEngine, TriggerData } from './WorkflowEngine'
import { WorkflowLogger } from './WorkflowLogger'
import { WorkflowPlan, WorkflowExecution } from '../types/workflow'
import { MailActionService } from '../../types/mailActions'

/**
 * Debug wrapper for WorkflowEngine that adds comprehensive logging
 * without modifying the core engine code
 */
export class DebugWorkflowEngine extends WorkflowEngine {
  private logger: WorkflowLogger

  constructor(mailActions: MailActionService, logger?: WorkflowLogger) {
    super(mailActions)
    this.logger = logger || new WorkflowLogger({ logToConsole: true })
  }

  async executeWorkflow(plan: WorkflowPlan, triggerData?: TriggerData): Promise<WorkflowExecution> {
    const startTime = Date.now()

    // We'll get the actual execution ID after calling super.executeWorkflow
    const tempLogContext = {
      workflowId: plan.id,
      executionId: 'pending'
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
      tempLogContext
    )

    // Log each step configuration
    plan.steps.forEach((step, index) => {
      this.logger.debug(
        `Step ${index + 1} configuration`,
        {
          stepId: step.id,
          functionName: step.functionName,
          hasCondition: !!step.condition,
          condition: step.condition,
          errorHandling: step.onError
        },
        tempLogContext
      )
    })

    try {
      const execution = await super.executeWorkflow(plan, triggerData)

      const duration = Date.now() - startTime

      // Now we have the actual execution ID
      const logContext = {
        workflowId: plan.id,
        executionId: execution.id
      }

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

      // Log detailed results
      execution.stepResults.forEach((result, index) => {
        const emoji = result.status === 'success' ? '✅' : result.status === 'failed' ? '❌' : '⏭️'
        this.logger.info(
          `${emoji} Step ${index + 1} (${result.stepId}): ${result.status}`,
          {
            duration: result.completedAt.getTime() - result.startedAt.getTime() + 'ms',
            output: result.output,
            error: result.error?.message
          },
          { ...logContext, stepId: result.stepId }
        )
      })

      return execution
    } catch (error) {
      const duration = Date.now() - startTime

      this.logger.error(
        '💥 Workflow execution crashed',
        {
          duration: `${duration}ms`,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        },
        tempLogContext
      )

      throw error
    }
  }

  // Get logs for debugging
  getLogger(): WorkflowLogger {
    return this.logger
  }

  // Get execution logs
  getExecutionLogs(executionId: string): string {
    const logs = this.logger.getLogsForExecution(executionId)
    return JSON.stringify(logs, null, 2)
  }

  // Get workflow logs
  getWorkflowLogs(workflowId: string): string {
    const logs = this.logger.getLogsForWorkflow(workflowId)
    return JSON.stringify(logs, null, 2)
  }

  // Export all logs
  exportAllLogs(): string {
    return this.logger.exportLogs()
  }

  // Clear logs
  clearLogs(): void {
    this.logger.clearLogs()
  }
}
