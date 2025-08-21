// Workflow engine types
import { EmailComposition, ScheduledEmail } from '../../types/mailActions'

export interface WorkflowTrigger {
  id: string
  type: 'email_from' | 'email_subject' | 'timer'
  config: EmailFromTrigger | EmailSubjectTrigger | TimerTrigger
}

export interface EmailFromTrigger {
  fromAddress: string
}

export interface EmailSubjectTrigger {
  subject: string
  matchType?: 'exact' | 'contains' | 'regex'
}

export interface TimerTrigger {
  interval?: number // Every X minutes
  specificTime?: string // "15:30" for 3:30 PM
  timezone?: string
}

// Available functions from MailActionService
export type WorkflowFunction = 'sendEmail' | 'scheduleEmail' | 'listenForEmails' | 'analysis'

export interface WorkflowStep {
  id: string
  functionName: WorkflowFunction
  inputs: SendEmailInputs | ScheduleEmailInputs | ListenInputs | AnalysisInputs
  condition?: StepCondition
  onError?: ErrorHandling
}

// Step conditions for branching
export interface StepCondition {
  type: 'previousStepOutput' | 'always' | 'never'
  field?: string // Path to field in previous step output
  operator?: 'equals' | 'contains' | 'exists' | 'notExists'
  value?: unknown
}

// Error handling configuration
export interface ErrorHandling {
  action: 'stop' | 'continue' | 'retry' | 'fallbackStep'
  retryCount?: number
  retryDelay?: number // milliseconds
  fallbackStepId?: string
  notifyEmail?: string // Send error notification
}

// Input types for each function
export interface SendEmailInputs {
  composition:
    | EmailComposition
    | {
        fromPreviousStep?: string // Reference to previous step output
      }
}

export interface ScheduleEmailInputs {
  scheduledEmail:
    | ScheduledEmail
    | {
        fromPreviousStep?: string
      }
}

export interface ListenInputs {
  senders: string[]
  subject?: string
  labels?: string[]
}

export interface AnalysisInputs {
  prompt: string
  useTriggeredEmail?: boolean // Use the email that triggered the workflow
  emailsFromPreviousStep?: string
}

export interface WorkflowPlan {
  id: string
  name: string
  description?: string
  trigger: WorkflowTrigger
  steps: WorkflowStep[]
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  triggeredBy: {
    type: string
    data?: unknown
  }
  status: 'running' | 'completed' | 'failed'
  startedAt: Date
  completedAt?: Date
  stepResults: StepResult[]
}

export interface StepResult {
  stepId: string
  status: 'success' | 'failed' | 'skipped'
  output?: unknown
  error?: Error
  startedAt: Date
  completedAt: Date
}
