import {
  MailActionService,
  EmailComposition,
  ScheduledEmail,
  LabelOperation,
  EmailLabel,
  InboxListener,
  EmailMessage,
  MailActionResult,
  SendEmailResult,
  ScheduleEmailResult,
  LabelOperationResult,
  ListenInboxResult
} from '../../types/mailActions'

export class MockMailActionService implements MailActionService {
  private scheduledEmails: Map<string, ScheduledEmail> = new Map()
  private labels: Map<string, EmailLabel> = new Map()
  private inboxListeners: Map<string, InboxListener> = new Map()
  private mockInbox: EmailMessage[] = []

  constructor() {
    console.log('[MockMailActionService] Initialized')
    this.initializeDefaultLabels()
    this.initializeMockInbox()
  }

  private initializeDefaultLabels(): void {
    const defaultLabels: EmailLabel[] = [
      { id: 'inbox', name: 'Inbox', color: '#4285f4' },
      { id: 'sent', name: 'Sent', color: '#34a853' },
      { id: 'draft', name: 'Draft', color: '#fbbc04' },
      { id: 'spam', name: 'Spam', color: '#ea4335' },
      { id: 'trash', name: 'Trash', color: '#666666' }
    ]

    defaultLabels.forEach((label) => this.labels.set(label.id, label))
  }

  private initializeMockInbox(): void {
    this.mockInbox = [
      {
        id: 'mock-1',
        from: { email: 'test@example.com', name: 'Test User' },
        to: [{ email: 'me@example.com' }],
        subject: 'Test Email 1',
        body: 'This is a test email body',
        date: new Date(),
        labels: ['inbox'],
        isRead: false,
        hasAttachment: false,
        threadId: 'thread-1'
      }
    ]
  }

  private createError(code: string, message: string, details?: unknown): MailActionResult {
    console.error(`[MockMailActionService] Error: ${code} - ${message}`, details)
    return {
      success: false,
      error: { code, message, details }
    }
  }

  private createSuccess<T>(data?: T): MailActionResult<T> {
    return { success: true, data }
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // Send operations
  async sendEmail(composition: EmailComposition): Promise<SendEmailResult> {
    console.log('[MockMailActionService] sendEmail called:', composition)

    // Validate required fields
    if (!composition.to || composition.to.length === 0) {
      return this.createError('INVALID_RECIPIENT', 'At least one recipient is required')
    }

    if (!composition.subject || composition.subject.trim() === '') {
      return this.createError('INVALID_SUBJECT', 'Subject is required')
    }

    if (!composition.body || composition.body.trim() === '') {
      return this.createError('INVALID_BODY', 'Email body is required')
    }

    const messageId = this.generateId('msg')

    console.log(`[MockMailActionService] Email sent successfully:
      Message ID: ${messageId}
      To: ${composition.to.map((r) => r.email).join(', ')}
      Subject: ${composition.subject}
      Body: ${composition.body.substring(0, 100)}...
    `)

    // Simulate adding to sent folder
    const sentEmail: EmailMessage = {
      id: messageId,
      from: { email: 'me@example.com', name: 'Me' },
      to: composition.to,
      cc: composition.cc,
      subject: composition.subject,
      body: composition.body,
      date: new Date(),
      labels: ['sent'],
      isRead: true,
      hasAttachment: false,
      threadId: composition.replyTo ? `thread-${composition.replyTo}` : this.generateId('thread')
    }

    this.mockInbox.push(sentEmail)

    return this.createSuccess({ messageId })
  }

  async scheduleEmail(scheduledEmail: ScheduledEmail): Promise<ScheduleEmailResult> {
    console.log('[MockMailActionService] scheduleEmail called:', scheduledEmail)

    // Validate scheduled time
    if (!scheduledEmail.scheduledTime || scheduledEmail.scheduledTime <= new Date()) {
      return this.createError('INVALID_SCHEDULE_TIME', 'Scheduled time must be in the future')
    }

    const scheduledId = this.generateId('scheduled')
    const emailWithId = { ...scheduledEmail, id: scheduledId }

    this.scheduledEmails.set(scheduledId, emailWithId)

    console.log(`[MockMailActionService] Email scheduled:
      Scheduled ID: ${scheduledId}
      Scheduled for: ${scheduledEmail.scheduledTime.toISOString()}
      Subject: ${scheduledEmail.subject}
    `)

    // Simulate scheduling
    const delay = scheduledEmail.scheduledTime.getTime() - Date.now()
    setTimeout(
      () => {
        console.log(`[MockMailActionService] Scheduled email ${scheduledId} would be sent now`)
        this.scheduledEmails.delete(scheduledId)
      },
      Math.min(delay, 60000)
    ) // Cap at 1 minute for testing

    return this.createSuccess({ scheduledId })
  }


  // Label operations
  async addLabels(operation: LabelOperation): Promise<LabelOperationResult> {
    console.log('[MockMailActionService] addLabels called:', operation)

    // Find email in mock inbox
    const email = this.mockInbox.find((e) => e.id === operation.emailId)
    if (!email) {
      return this.createError('NOT_FOUND', `Email ${operation.emailId} not found`)
    }

    // Add labels
    operation.labelIds.forEach((labelId) => {
      if (!email.labels.includes(labelId)) {
        email.labels.push(labelId)
      }
    })

    console.log(
      `[MockMailActionService] Added labels ${operation.labelIds.join(', ')} to email ${operation.emailId}`
    )
    return this.createSuccess()
  }

  async removeLabels(operation: LabelOperation): Promise<LabelOperationResult> {
    console.log('[MockMailActionService] removeLabels called:', operation)

    const email = this.mockInbox.find((e) => e.id === operation.emailId)
    if (!email) {
      return this.createError('NOT_FOUND', `Email ${operation.emailId} not found`)
    }

    email.labels = email.labels.filter((label) => !operation.labelIds.includes(label))

    console.log(
      `[MockMailActionService] Removed labels ${operation.labelIds.join(', ')} from email ${operation.emailId}`
    )
    return this.createSuccess()
  }


  // Email monitoring operations
  async listenForEmails(senders: string[], options?: {
    subject?: string
    labels?: string[]
    callback?: (email: EmailMessage) => void
  }): Promise<ListenInboxResult> {
    console.log('[MockMailActionService] listenForEmails called for senders:', senders, 'options:', options)

    const listenerId = this.generateId('listener')
    
    // Create a listener that checks for emails from any of the specified senders
    const listener: InboxListener = {
      id: listenerId,
      filter: {
        from: senders[0], // For now, use first sender
        subject: options?.subject,
        labels: options?.labels
      },
      callback: (email) => {
        // Check if email is from any of the specified senders
        const senderEmail = typeof email.from === 'string' ? email.from : email.from.email
        if (senders.some(sender => senderEmail.toLowerCase().includes(sender.toLowerCase()))) {
          console.log(`[MockMailActionService] Email from monitored sender: ${senderEmail}`)
          if (options?.callback) {
            options.callback(email)
          }
        }
      }
    }

    this.inboxListeners.set(listenerId, listener)

    console.log(`[MockMailActionService] Started listening for emails from ${senders.join(', ')} with ID: ${listenerId}`)

    // Simulate incoming email from one of the senders after 5 seconds
    setTimeout(() => {
      const newEmail: EmailMessage = {
        id: this.generateId('msg'),
        from: { email: senders[0], name: 'Monitored Sender' },
        to: [{ email: 'me@example.com' }],
        subject: options?.subject || 'New email from monitored sender',
        body: 'This is a simulated email from a monitored sender',
        date: new Date(),
        labels: options?.labels || ['inbox'],
        isRead: false,
        hasAttachment: false,
        threadId: this.generateId('thread')
      }

      this.mockInbox.push(newEmail)

      // Notify the listener
      listener.callback(newEmail)
    }, 5000)

    return this.createSuccess({ listenerId })
  }


  private emailMatchesFilter(email: EmailMessage, filter?: InboxListener['filter']): boolean {
    if (!filter) return true

    if (filter.from && !email.from.email.includes(filter.from)) return false
    if (filter.subject && !email.subject.toLowerCase().includes(filter.subject.toLowerCase()))
      return false
    if (filter.hasAttachment !== undefined && email.hasAttachment !== filter.hasAttachment)
      return false
    if (
      filter.labels &&
      filter.labels.length > 0 &&
      !filter.labels.some((label) => email.labels.includes(label))
    )
      return false

    return true
  }
}
