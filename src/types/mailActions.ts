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
export type CancelScheduledResult = MailActionResult<void>
export type GetScheduledEmailsResult = MailActionResult<ScheduledEmail[]>
export type CreateDraftResult = MailActionResult<{ draftId: string }>
export type UpdateDraftResult = MailActionResult<void>
export type DeleteDraftResult = MailActionResult<void>
export type GetDraftsResult = MailActionResult<EmailMessage[]>
export type LabelOperationResult = MailActionResult<void>
export type GetLabelsResult = MailActionResult<EmailLabel[]>
export type CreateLabelResult = MailActionResult<EmailLabel>
export type ReadEmailResult = MailActionResult<EmailMessage>
export type ReadEmailsResult = MailActionResult<EmailMessage[]>
export type MarkReadResult = MailActionResult<void>
export type SearchEmailsResult = MailActionResult<EmailMessage[]>
export type CheckInboxResult = MailActionResult<EmailMessage[]>
export type ListenInboxResult = MailActionResult<{ listenerId: string }>
export type StopListeningResult = MailActionResult<void>
export type GetThreadResult = MailActionResult<EmailMessage[]>
export type CheckResponseResult = MailActionResult<EmailMessage[]>

export interface MailActionService {
  // Send operations
  sendEmail(composition: EmailComposition): Promise<SendEmailResult>
  scheduleEmail(scheduledEmail: ScheduledEmail): Promise<ScheduleEmailResult>
  cancelScheduledEmail(scheduledId: string): Promise<CancelScheduledResult>
  getScheduledEmails(): Promise<GetScheduledEmailsResult>

  // Compose operations
  createDraft(composition: EmailComposition): Promise<CreateDraftResult>
  updateDraft(draftId: string, composition: Partial<EmailComposition>): Promise<UpdateDraftResult>
  deleteDraft(draftId: string): Promise<DeleteDraftResult>
  getDrafts(): Promise<GetDraftsResult>

  // Label operations
  addLabels(operation: LabelOperation): Promise<LabelOperationResult>
  removeLabels(operation: LabelOperation): Promise<LabelOperationResult>
  setLabels(operation: LabelOperation): Promise<LabelOperationResult>
  getLabels(): Promise<GetLabelsResult>
  createLabel(label: Omit<EmailLabel, 'id'>): Promise<CreateLabelResult>

  // Read operations
  readEmail(emailId: string): Promise<ReadEmailResult>
  readEmails(emailIds: string[]): Promise<ReadEmailsResult>
  markAsRead(emailId: string): Promise<MarkReadResult>
  markAsUnread(emailId: string): Promise<MarkReadResult>
  searchEmails(query: string, limit?: number): Promise<SearchEmailsResult>

  // Inbox operations
  checkInbox(filter?: InboxListener['filter']): Promise<CheckInboxResult>
  listenToInbox(listener: Omit<InboxListener, 'id'>): Promise<ListenInboxResult>
  stopListening(listenerId: string): Promise<StopListeningResult>

  // Thread operations
  getThread(threadId: string): Promise<GetThreadResult>
  checkForResponse(originalMessageId: string): Promise<CheckResponseResult>
}
