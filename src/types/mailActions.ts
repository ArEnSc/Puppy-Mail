// Types for mail action service operations

export interface EmailAddress {
  email: string
  name?: string
}

export interface EmailComposition {
  to: EmailAddress[]
  cc?: EmailAddress[]
  bcc?: EmailAddress[]
  subject: string
  body: string
  attachments?: string[] // File paths
  replyTo?: string // Email ID being replied to
  isHtml?: boolean
}

export interface ScheduledEmail extends EmailComposition {
  scheduledTime: Date
  id?: string
}

export interface EmailLabel {
  id: string
  name: string
  color?: string
}

export interface LabelOperation {
  emailId: string
  labelIds: string[]
  operation: 'add' | 'remove' | 'set'
}

export interface InboxListener {
  id: string
  filter?: {
    from?: string
    subject?: string
    hasAttachment?: boolean
    labels?: string[]
  }
  callback: (email: EmailMessage) => void
}

export interface EmailMessage {
  id: string
  from: EmailAddress
  to: EmailAddress[]
  cc?: EmailAddress[]
  subject: string
  body: string
  date: Date
  labels: string[]
  isRead: boolean
  hasAttachment: boolean
  threadId?: string
}

export interface MailActionResult<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

// Return type definitions for mail actions
export type SendEmailResult = MailActionResult<{ messageId: string }>
export type ScheduleEmailResult = MailActionResult<{ scheduledId: string }>
export type LabelOperationResult = MailActionResult<void>
export type ListenInboxResult = MailActionResult<{ listenerId: string }>
export type AnalysisResult = MailActionResult<string | string[]>

export interface MailActionService {
  // Send operations
  sendEmail(composition: EmailComposition): Promise<SendEmailResult>
  scheduleEmail(scheduledEmail: ScheduledEmail): Promise<ScheduleEmailResult>

  // Label operations
  addLabels(operation: LabelOperation): Promise<LabelOperationResult>
  removeLabels(operation: LabelOperation): Promise<LabelOperationResult>

  // Email monitoring operations
  listenForEmails(
    senders: string[],
    options?: {
      subject?: string
      labels?: string[]
      callback?: (email: EmailMessage) => void
    }
  ): Promise<ListenInboxResult>

  // Analysis operations
  analysis(
    prompt: string,
    context?: {
      emails?: EmailMessage[]
      data?: Record<string, unknown>
    }
  ): Promise<AnalysisResult>
}
