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

export interface MailActionResult<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
}

export interface MailActionService {
  // Send operations
  sendEmail(composition: EmailComposition): Promise<MailActionResult<{ messageId: string }>>
  scheduleEmail(scheduledEmail: ScheduledEmail): Promise<MailActionResult<{ scheduledId: string }>>
  cancelScheduledEmail(scheduledId: string): Promise<MailActionResult<void>>
  getScheduledEmails(): Promise<MailActionResult<ScheduledEmail[]>>
  
  // Compose operations
  createDraft(composition: EmailComposition): Promise<MailActionResult<{ draftId: string }>>
  updateDraft(draftId: string, composition: Partial<EmailComposition>): Promise<MailActionResult<void>>
  deleteDraft(draftId: string): Promise<MailActionResult<void>>
  getDrafts(): Promise<MailActionResult<EmailMessage[]>>
  
  // Label operations
  addLabels(operation: LabelOperation): Promise<MailActionResult<void>>
  removeLabels(operation: LabelOperation): Promise<MailActionResult<void>>
  setLabels(operation: LabelOperation): Promise<MailActionResult<void>>
  getLabels(): Promise<MailActionResult<EmailLabel[]>>
  createLabel(label: Omit<EmailLabel, 'id'>): Promise<MailActionResult<EmailLabel>>
  
  // Read operations
  readEmail(emailId: string): Promise<MailActionResult<EmailMessage>>
  readEmails(emailIds: string[]): Promise<MailActionResult<EmailMessage[]>>
  markAsRead(emailId: string): Promise<MailActionResult<void>>
  markAsUnread(emailId: string): Promise<MailActionResult<void>>
  searchEmails(query: string, limit?: number): Promise<MailActionResult<EmailMessage[]>>
  
  // Inbox operations
  checkInbox(filter?: InboxListener['filter']): Promise<MailActionResult<EmailMessage[]>>
  listenToInbox(listener: Omit<InboxListener, 'id'>): Promise<MailActionResult<{ listenerId: string }>>
  stopListening(listenerId: string): Promise<MailActionResult<void>>
  
  // Thread operations
  getThread(threadId: string): Promise<MailActionResult<EmailMessage[]>>
  checkForResponse(originalMessageId: string): Promise<MailActionResult<EmailMessage[]>>
}