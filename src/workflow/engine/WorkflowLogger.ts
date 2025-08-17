export interface LogEntry {
  timestamp: Date
  level: 'debug' | 'info' | 'warn' | 'error'
  workflowId?: string
  executionId?: string
  stepId?: string
  message: string
  data?: unknown
}

export class WorkflowLogger {
  private logs: LogEntry[] = []
  private maxLogs = 1000
  private logToConsole = true

  constructor(options?: { maxLogs?: number; logToConsole?: boolean }) {
    if (options?.maxLogs) this.maxLogs = options.maxLogs
    if (options?.logToConsole !== undefined) this.logToConsole = options.logToConsole
  }

  private log(entry: LogEntry): void {
    this.logs.push(entry)

    // Keep logs under limit
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // Console output
    if (this.logToConsole) {
      const prefix = `[${entry.level.toUpperCase()}] ${entry.timestamp.toISOString()}`
      const context = [
        entry.workflowId && `workflow:${entry.workflowId}`,
        entry.executionId && `exec:${entry.executionId}`,
        entry.stepId && `step:${entry.stepId}`
      ]
        .filter(Boolean)
        .join(' ')

      const message = context
        ? `${prefix} ${context} - ${entry.message}`
        : `${prefix} - ${entry.message}`

      switch (entry.level) {
        case 'error':
          console.error(message, entry.data || '')
          break
        case 'warn':
          console.warn(message, entry.data || '')
          break
        case 'debug':
          console.debug(message, entry.data || '')
          break
        default:
          console.log(message, entry.data || '')
      }
    }
  }

  debug(
    message: string,
    data?: unknown,
    context?: { workflowId?: string; executionId?: string; stepId?: string }
  ): void {
    this.log({
      timestamp: new Date(),
      level: 'debug',
      message,
      data,
      ...context
    })
  }

  info(
    message: string,
    data?: unknown,
    context?: { workflowId?: string; executionId?: string; stepId?: string }
  ): void {
    this.log({
      timestamp: new Date(),
      level: 'info',
      message,
      data,
      ...context
    })
  }

  warn(
    message: string,
    data?: unknown,
    context?: { workflowId?: string; executionId?: string; stepId?: string }
  ): void {
    this.log({
      timestamp: new Date(),
      level: 'warn',
      message,
      data,
      ...context
    })
  }

  error(
    message: string,
    data?: unknown,
    context?: { workflowId?: string; executionId?: string; stepId?: string }
  ): void {
    this.log({
      timestamp: new Date(),
      level: 'error',
      message,
      data,
      ...context
    })
  }

  getLogsForExecution(executionId: string): LogEntry[] {
    return this.logs.filter((log) => log.executionId === executionId)
  }

  getLogsForWorkflow(workflowId: string): LogEntry[] {
    return this.logs.filter((log) => log.workflowId === workflowId)
  }

  getAllLogs(): LogEntry[] {
    return [...this.logs]
  }

  clearLogs(): void {
    this.logs = []
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }
}
