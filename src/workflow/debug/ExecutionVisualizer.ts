import { WorkflowExecution, WorkflowPlan } from '../types/workflow'
import { LogEntry } from '../engine/WorkflowLogger'

export class ExecutionVisualizer {
  private static readonly INDENT = '  '

  /**
   * Generate a live execution visualization with logs
   */
  static visualizeExecutionWithLogs(
    plan: WorkflowPlan,
    execution: WorkflowExecution,
    logs: LogEntry[]
  ): string {
    const lines: string[] = []

    // Header
    lines.push('🔍 Workflow Execution Visualization')
    lines.push('═'.repeat(60))
    lines.push(`Workflow: ${plan.name}`)
    lines.push(`Execution ID: ${execution.id}`)
    lines.push(`Status: ${this.formatStatus(execution.status)}`)
    if (execution.completedAt) {
      const duration = execution.completedAt.getTime() - execution.startedAt.getTime()
      lines.push(`Duration: ${duration}ms`)
    }
    lines.push('')

    // Trigger info
    lines.push('🎯 Trigger')
    lines.push(`${this.INDENT}Type: ${execution.triggeredBy.type}`)
    if (execution.triggeredBy.data) {
      const triggerData = execution.triggeredBy.data as Record<string, unknown>
      if (triggerData.email) {
        const email = triggerData.email as { from?: { email?: string }; subject?: string }
        lines.push(
          `${this.INDENT}Email: ${email.from?.email || 'unknown'} → ${email.subject || 'no subject'}`
        )
      }
    }
    lines.push('')

    // Step execution flow
    lines.push('📝 Execution Flow')
    lines.push('')

    // Group logs by step
    const logsByStep = this.groupLogsByStep(logs)

    plan.steps.forEach((step, index) => {
      const stepResult = execution.stepResults.find((r) => r.stepId === step.id)
      const stepLogs = logsByStep.get(step.id) || []

      // Step header
      const stepNumber = `${index + 1}.`
      const stepStatus = stepResult ? this.formatStepStatus(stepResult.status) : '⏳'
      lines.push(`${stepNumber} ${stepStatus} ${step.id} [${step.functionName}]`)

      // Step condition
      if (step.condition) {
        lines.push(
          `${this.INDENT}├─ Condition: ${step.condition.field} ${step.condition.operator} ${step.condition.value}`
        )

        // Find condition evaluation in main logs if not in step logs
        const conditionEvaluation = this.findConditionResult(step.id, logs)
        if (conditionEvaluation !== null) {
          lines.push(
            `${this.INDENT}│  └─ Evaluated: ${conditionEvaluation ? '✅ true' : '❌ false'}`
          )
        }
      }

      // Step timing
      if (stepResult) {
        const duration = stepResult.completedAt.getTime() - stepResult.startedAt.getTime()
        lines.push(`${this.INDENT}├─ Duration: ${duration}ms`)
      }

      // Step logs
      const relevantLogs = stepLogs.filter(
        (log) =>
          !log.message.includes('configuration') && !log.message.includes('Starting workflow')
      )

      if (relevantLogs.length > 0) {
        lines.push(`${this.INDENT}├─ Logs:`)
        relevantLogs.forEach((log) => {
          const logLine = this.formatLogEntry(log)
          lines.push(`${this.INDENT}│  ${logLine}`)
        })
      }

      // Step output/error
      if (stepResult) {
        if (stepResult.status === 'success' && stepResult.output) {
          lines.push(`${this.INDENT}├─ Output:`)
          const output = this.formatOutput(stepResult.output)
          output.split('\n').forEach((line) => {
            lines.push(`${this.INDENT}│  ${line}`)
          })
        } else if (stepResult.status === 'failed' && stepResult.error) {
          lines.push(`${this.INDENT}├─ Error: ${stepResult.error.message}`)
        } else if (stepResult.status === 'skipped') {
          lines.push(`${this.INDENT}├─ Skipped: Condition not met`)
        }
      }

      // Connection to next step
      if (index < plan.steps.length - 1) {
        lines.push(`${this.INDENT}│`)
        lines.push(`${this.INDENT}↓`)
      } else {
        lines.push(`${this.INDENT}└─ End`)
      }
      lines.push('')
    })

    // Summary
    lines.push('📊 Summary')
    const successful = execution.stepResults.filter((r) => r.status === 'success').length
    const failed = execution.stepResults.filter((r) => r.status === 'failed').length
    const skipped = execution.stepResults.filter((r) => r.status === 'skipped').length

    lines.push(`${this.INDENT}Total Steps: ${execution.stepResults.length}`)
    lines.push(`${this.INDENT}✅ Successful: ${successful}`)
    if (failed > 0) lines.push(`${this.INDENT}❌ Failed: ${failed}`)
    if (skipped > 0) lines.push(`${this.INDENT}⏭️  Skipped: ${skipped}`)

    return lines.join('\n')
  }

  /**
   * Create a simple execution timeline
   */
  static createTimeline(execution: WorkflowExecution): string {
    const lines: string[] = []
    const startTime = execution.startedAt.getTime()

    lines.push('⏱️  Execution Timeline')
    lines.push('─'.repeat(60))

    execution.stepResults.forEach((result) => {
      const relativeStart = result.startedAt.getTime() - startTime
      const duration = result.completedAt.getTime() - result.startedAt.getTime()

      const timeStr = `+${relativeStart}ms`
      const durationStr = `(${duration}ms)`
      const status = this.formatStepStatus(result.status)

      lines.push(`${timeStr.padEnd(10)} ${status} ${result.stepId.padEnd(20)} ${durationStr}`)
    })

    if (execution.completedAt) {
      const totalDuration = execution.completedAt.getTime() - startTime
      lines.push('─'.repeat(60))
      lines.push(`Total: ${totalDuration}ms`)
    }

    return lines.join('\n')
  }

  private static groupLogsByStep(logs: LogEntry[]): Map<string, LogEntry[]> {
    const grouped = new Map<string, LogEntry[]>()

    logs.forEach((log) => {
      if (log.stepId) {
        const stepLogs = grouped.get(log.stepId) || []
        stepLogs.push(log)
        grouped.set(log.stepId, stepLogs)
      }
    })

    return grouped
  }

  private static findConditionResult(stepId: string, logs: LogEntry[]): boolean | null {
    // Look for condition evaluation in logs
    for (const log of logs) {
      if (log.message.includes(stepId) && log.data) {
        const data = log.data as Record<string, unknown>
        if (data.condition !== undefined || data.shouldExecute !== undefined) {
          return Boolean(data.condition || data.shouldExecute)
        }
      }
    }
    return null
  }

  private static formatStatus(status: string): string {
    switch (status) {
      case 'completed':
        return '✅ Completed'
      case 'failed':
        return '❌ Failed'
      case 'running':
        return '🔄 Running'
      default:
        return status
    }
  }

  private static formatStepStatus(status: string): string {
    switch (status) {
      case 'success':
        return '✅'
      case 'failed':
        return '❌'
      case 'skipped':
        return '⏭️'
      default:
        return '❓'
    }
  }

  private static formatLogEntry(log: LogEntry): string {
    const timestamp = new Date(log.timestamp).toISOString().split('T')[1].split('.')[0]
    const level = log.level === 'debug' ? '[DEBUG]' : '[INFO]'
    return `${timestamp} ${level} ${log.message}`
  }

  private static formatOutput(output: unknown): string {
    if (typeof output === 'string') {
      return output
    }

    const str = JSON.stringify(output, null, 2)
    if (str.length > 200) {
      return str.substring(0, 200) + '...'
    }
    return str
  }
}
