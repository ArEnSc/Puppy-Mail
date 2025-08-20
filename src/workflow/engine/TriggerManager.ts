import {
  WorkflowPlan,
  EmailFromTrigger,
  EmailSubjectTrigger,
  TimerTrigger
} from '../types/workflow'
import { EmailMessage } from '../../types/mailActions'
import { WorkflowEngine } from './WorkflowEngine'

export class TriggerManager {
  private workflowEngine: WorkflowEngine
  private enabledWorkflows: Map<string, WorkflowPlan> = new Map()
  private timers: Map<string, NodeJS.Timeout> = new Map()

  constructor(workflowEngine: WorkflowEngine) {
    this.workflowEngine = workflowEngine
  }

  registerWorkflow(workflow: WorkflowPlan): void {
    if (!workflow.enabled) return

    this.enabledWorkflows.set(workflow.id, workflow)

    // Set up timer triggers
    if (workflow.trigger.type === 'timer') {
      this.setupTimerTrigger(workflow)
    }
  }

  unregisterWorkflow(workflowId: string): void {
    this.enabledWorkflows.delete(workflowId)

    // Clear any existing timers
    const timer = this.timers.get(workflowId)
    if (timer) {
      clearInterval(timer)
      this.timers.delete(workflowId)
    }
  }

  async handleIncomingEmail(email: EmailMessage): Promise<void> {
    const triggeredWorkflows: WorkflowPlan[] = []

    for (const workflow of this.enabledWorkflows.values()) {
      if (this.shouldTriggerForEmail(workflow, email)) {
        triggeredWorkflows.push(workflow)
      }
    }

    // Execute all triggered workflows in parallel
    await Promise.all(
      triggeredWorkflows.map((workflow) =>
        this.workflowEngine.executeWorkflow(workflow, {
          emailId: email.id,
          email
        })
      )
    )
  }

  private shouldTriggerForEmail(workflow: WorkflowPlan, email: EmailMessage): boolean {
    const { trigger } = workflow

    switch (trigger.type) {
      case 'email_from': {
        const config = trigger.config as EmailFromTrigger
        return email.from.email.toLowerCase() === config.fromAddress.toLowerCase()
      }

      case 'email_subject': {
        const config = trigger.config as EmailSubjectTrigger
        const subject = email.subject.toLowerCase()
        const searchTerm = config.subject.toLowerCase()

        switch (config.matchType) {
          case 'exact':
            return subject === searchTerm
          case 'contains':
            return subject.includes(searchTerm)
          case 'regex':
            try {
              const regex = new RegExp(config.subject, 'i')
              return regex.test(email.subject)
            } catch {
              return false
            }
          default:
            return subject.includes(searchTerm)
        }
      }

      default:
        return false
    }
  }

  private setupTimerTrigger(workflow: WorkflowPlan): void {
    const config = workflow.trigger.config as TimerTrigger

    if (config.interval) {
      // Set up interval timer (in minutes)
      const intervalMs = config.interval * 60 * 1000
      const timer = setInterval(() => {
        this.workflowEngine.executeWorkflow(workflow, {
          triggeredAt: new Date()
        })
      }, intervalMs)

      this.timers.set(workflow.id, timer)
    } else if (config.specificTime) {
      // Set up daily timer at specific time
      this.scheduleDaily(workflow, config.specificTime)
    }
  }

  private scheduleDaily(workflow: WorkflowPlan, timeStr: string): void {
    const [hours, minutes] = timeStr.split(':').map(Number)

    const now = new Date()
    const scheduledTime = new Date()
    scheduledTime.setHours(hours, minutes, 0, 0)

    // If the time has already passed today, schedule for tomorrow
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1)
    }

    const msUntilExecution = scheduledTime.getTime() - now.getTime()

    // Schedule the first execution
    setTimeout(() => {
      // Execute the workflow
      this.workflowEngine.executeWorkflow(workflow, {
        triggeredAt: new Date()
      })

      // Set up daily interval
      const timer = setInterval(
        () => {
          this.workflowEngine.executeWorkflow(workflow, {
            triggeredAt: new Date()
          })
        },
        24 * 60 * 60 * 1000
      ) // 24 hours

      this.timers.set(workflow.id, timer)
    }, msUntilExecution)
  }

  shutdown(): void {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearInterval(timer)
    }
    this.timers.clear()
    this.enabledWorkflows.clear()
  }
}
