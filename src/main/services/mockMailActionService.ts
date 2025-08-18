import {
  MailActionService,
  EmailComposition,
  ScheduledEmail,
  LabelOperation,
  EmailLabel,
  InboxListener,
  EmailMessage,
  MailActionResult,
} from '../../types/mailActions'

export class MockMailActionService implements MailActionService {
  private scheduledEmails: Map<string, ScheduledEmail> = new Map()
  private drafts: Map<string, EmailMessage> = new Map()
  private labels: Map<string, EmailLabel> = new Map()
  private inboxListeners: Map<string, InboxListener> = new Map()
  private mockInbox: EmailMessage[] = []
  
  constructor() {
    console.log('[MockMailActionService] Initialized')
    this.initializeDefaultLabels()
    this.initializeMockInbox()
  }
  
  private initializeDefaultLabels() {
    const defaultLabels: EmailLabel[] = [
      { id: 'inbox', name: 'Inbox', color: '#4285f4' },
      { id: 'sent', name: 'Sent', color: '#34a853' },
      { id: 'draft', name: 'Draft', color: '#fbbc04' },
      { id: 'spam', name: 'Spam', color: '#ea4335' },
      { id: 'trash', name: 'Trash', color: '#666666' },
    ]
    
    defaultLabels.forEach(label => this.labels.set(label.id, label))
  }
  
  private initializeMockInbox() {
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
  
  private createError(code: string, message: string, details?: any): MailActionResult {
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
  async sendEmail(composition: EmailComposition): Promise<MailActionResult<{ messageId: string }>> {
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
      To: ${composition.to.map(r => r.email).join(', ')}
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
  
  async scheduleEmail(scheduledEmail: ScheduledEmail): Promise<MailActionResult<{ scheduledId: string }>> {
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
    setTimeout(() => {
      console.log(`[MockMailActionService] Scheduled email ${scheduledId} would be sent now`)
      this.scheduledEmails.delete(scheduledId)
    }, Math.min(delay, 60000)) // Cap at 1 minute for testing
    
    return this.createSuccess({ scheduledId })
  }
  
  async cancelScheduledEmail(scheduledId: string): Promise<MailActionResult<void>> {
    console.log('[MockMailActionService] cancelScheduledEmail called:', scheduledId)
    
    if (!this.scheduledEmails.has(scheduledId)) {
      return this.createError('NOT_FOUND', `Scheduled email ${scheduledId} not found`)
    }
    
    this.scheduledEmails.delete(scheduledId)
    console.log(`[MockMailActionService] Scheduled email ${scheduledId} cancelled`)
    
    return this.createSuccess()
  }
  
  async getScheduledEmails(): Promise<MailActionResult<ScheduledEmail[]>> {
    console.log('[MockMailActionService] getScheduledEmails called')
    const emails = Array.from(this.scheduledEmails.values())
    console.log(`[MockMailActionService] Found ${emails.length} scheduled emails`)
    return this.createSuccess(emails)
  }
  
  // Compose operations
  async createDraft(composition: EmailComposition): Promise<MailActionResult<{ draftId: string }>> {
    console.log('[MockMailActionService] createDraft called:', composition)
    
    const draftId = this.generateId('draft')
    const draft: EmailMessage = {
      id: draftId,
      from: { email: 'me@example.com', name: 'Me' },
      to: composition.to,
      cc: composition.cc,
      subject: composition.subject,
      body: composition.body,
      date: new Date(),
      labels: ['draft'],
      isRead: true,
      hasAttachment: false
    }
    
    this.drafts.set(draftId, draft)
    console.log(`[MockMailActionService] Draft created with ID: ${draftId}`)
    
    return this.createSuccess({ draftId })
  }
  
  async updateDraft(draftId: string, composition: Partial<EmailComposition>): Promise<MailActionResult<void>> {
    console.log('[MockMailActionService] updateDraft called:', draftId, composition)
    
    const draft = this.drafts.get(draftId)
    if (!draft) {
      return this.createError('NOT_FOUND', `Draft ${draftId} not found`)
    }
    
    // Update draft fields
    if (composition.to) draft.to = composition.to
    if (composition.cc) draft.cc = composition.cc
    if (composition.subject !== undefined) draft.subject = composition.subject
    if (composition.body !== undefined) draft.body = composition.body
    
    console.log(`[MockMailActionService] Draft ${draftId} updated`)
    return this.createSuccess()
  }
  
  async deleteDraft(draftId: string): Promise<MailActionResult<void>> {
    console.log('[MockMailActionService] deleteDraft called:', draftId)
    
    if (!this.drafts.has(draftId)) {
      return this.createError('NOT_FOUND', `Draft ${draftId} not found`)
    }
    
    this.drafts.delete(draftId)
    console.log(`[MockMailActionService] Draft ${draftId} deleted`)
    return this.createSuccess()
  }
  
  async getDrafts(): Promise<MailActionResult<EmailMessage[]>> {
    console.log('[MockMailActionService] getDrafts called')
    const drafts = Array.from(this.drafts.values())
    console.log(`[MockMailActionService] Found ${drafts.length} drafts`)
    return this.createSuccess(drafts)
  }
  
  // Label operations
  async addLabels(operation: LabelOperation): Promise<MailActionResult<void>> {
    console.log('[MockMailActionService] addLabels called:', operation)
    
    // Find email in mock inbox
    const email = this.mockInbox.find(e => e.id === operation.emailId)
    if (!email) {
      return this.createError('NOT_FOUND', `Email ${operation.emailId} not found`)
    }
    
    // Add labels
    operation.labelIds.forEach(labelId => {
      if (!email.labels.includes(labelId)) {
        email.labels.push(labelId)
      }
    })
    
    console.log(`[MockMailActionService] Added labels ${operation.labelIds.join(', ')} to email ${operation.emailId}`)
    return this.createSuccess()
  }
  
  async removeLabels(operation: LabelOperation): Promise<MailActionResult<void>> {
    console.log('[MockMailActionService] removeLabels called:', operation)
    
    const email = this.mockInbox.find(e => e.id === operation.emailId)
    if (!email) {
      return this.createError('NOT_FOUND', `Email ${operation.emailId} not found`)
    }
    
    email.labels = email.labels.filter(label => !operation.labelIds.includes(label))
    
    console.log(`[MockMailActionService] Removed labels ${operation.labelIds.join(', ')} from email ${operation.emailId}`)
    return this.createSuccess()
  }
  
  async setLabels(operation: LabelOperation): Promise<MailActionResult<void>> {
    console.log('[MockMailActionService] setLabels called:', operation)
    
    const email = this.mockInbox.find(e => e.id === operation.emailId)
    if (!email) {
      return this.createError('NOT_FOUND', `Email ${operation.emailId} not found`)
    }
    
    email.labels = [...operation.labelIds]
    
    console.log(`[MockMailActionService] Set labels ${operation.labelIds.join(', ')} on email ${operation.emailId}`)
    return this.createSuccess()
  }
  
  async getLabels(): Promise<MailActionResult<EmailLabel[]>> {
    console.log('[MockMailActionService] getLabels called')
    const labels = Array.from(this.labels.values())
    console.log(`[MockMailActionService] Found ${labels.length} labels`)
    return this.createSuccess(labels)
  }
  
  async createLabel(label: Omit<EmailLabel, 'id'>): Promise<MailActionResult<EmailLabel>> {
    console.log('[MockMailActionService] createLabel called:', label)
    
    // Check if label already exists
    const existing = Array.from(this.labels.values()).find(l => l.name === label.name)
    if (existing) {
      return this.createError('ALREADY_EXISTS', `Label "${label.name}" already exists`)
    }
    
    const newLabel: EmailLabel = {
      ...label,
      id: this.generateId('label')
    }
    
    this.labels.set(newLabel.id, newLabel)
    console.log(`[MockMailActionService] Created label: ${newLabel.name} (${newLabel.id})`)
    
    return this.createSuccess(newLabel)
  }
  
  // Read operations
  async readEmail(emailId: string): Promise<MailActionResult<EmailMessage>> {
    console.log('[MockMailActionService] readEmail called:', emailId)
    
    const email = this.mockInbox.find(e => e.id === emailId)
    if (!email) {
      return this.createError('NOT_FOUND', `Email ${emailId} not found`)
    }
    
    // Mark as read
    email.isRead = true
    
    console.log(`[MockMailActionService] Read email:
      ID: ${email.id}
      From: ${email.from.email}
      Subject: ${email.subject}
      Body: ${email.body.substring(0, 100)}...
      Date: ${email.date.toISOString()}
      Labels: ${email.labels.join(', ')}
    `)
    
    return this.createSuccess(email)
  }
  
  async readEmails(emailIds: string[]): Promise<MailActionResult<EmailMessage[]>> {
    console.log('[MockMailActionService] readEmails called:', emailIds)
    
    const emails: EmailMessage[] = []
    const notFound: string[] = []
    
    for (const emailId of emailIds) {
      const email = this.mockInbox.find(e => e.id === emailId)
      if (email) {
        email.isRead = true
        emails.push(email)
      } else {
        notFound.push(emailId)
      }
    }
    
    if (notFound.length > 0) {
      console.warn(`[MockMailActionService] Some emails not found: ${notFound.join(', ')}`)
    }
    
    console.log(`[MockMailActionService] Read ${emails.length} emails`)
    return this.createSuccess(emails)
  }
  
  async markAsRead(emailId: string): Promise<MailActionResult<void>> {
    console.log('[MockMailActionService] markAsRead called:', emailId)
    
    const email = this.mockInbox.find(e => e.id === emailId)
    if (!email) {
      return this.createError('NOT_FOUND', `Email ${emailId} not found`)
    }
    
    email.isRead = true
    console.log(`[MockMailActionService] Marked email ${emailId} as read`)
    
    return this.createSuccess()
  }
  
  async markAsUnread(emailId: string): Promise<MailActionResult<void>> {
    console.log('[MockMailActionService] markAsUnread called:', emailId)
    
    const email = this.mockInbox.find(e => e.id === emailId)
    if (!email) {
      return this.createError('NOT_FOUND', `Email ${emailId} not found`)
    }
    
    email.isRead = false
    console.log(`[MockMailActionService] Marked email ${emailId} as unread`)
    
    return this.createSuccess()
  }
  
  async searchEmails(query: string, limit: number = 50): Promise<MailActionResult<EmailMessage[]>> {
    console.log('[MockMailActionService] searchEmails called:', query, 'limit:', limit)
    
    const queryLower = query.toLowerCase()
    
    // Search in subject, body, and sender
    let results = this.mockInbox.filter(email => 
      email.subject.toLowerCase().includes(queryLower) ||
      email.body.toLowerCase().includes(queryLower) ||
      email.from.email.toLowerCase().includes(queryLower) ||
      (email.from.name && email.from.name.toLowerCase().includes(queryLower))
    )
    
    // Apply limit
    results = results.slice(0, limit)
    
    console.log(`[MockMailActionService] Found ${results.length} emails matching "${query}"`)
    results.forEach(email => {
      console.log(`  - ${email.subject} from ${email.from.email}`)
    })
    
    return this.createSuccess(results)
  }
  
  // Inbox operations
  async checkInbox(filter?: InboxListener['filter']): Promise<MailActionResult<EmailMessage[]>> {
    console.log('[MockMailActionService] checkInbox called with filter:', filter)
    
    let emails = [...this.mockInbox]
    
    // Apply filters
    if (filter) {
      if (filter.from) {
        emails = emails.filter(e => e.from.email.includes(filter.from!))
      }
      if (filter.subject) {
        emails = emails.filter(e => e.subject.toLowerCase().includes(filter.subject!.toLowerCase()))
      }
      if (filter.hasAttachment !== undefined) {
        emails = emails.filter(e => e.hasAttachment === filter.hasAttachment)
      }
      if (filter.labels && filter.labels.length > 0) {
        emails = emails.filter(e => filter.labels!.some(label => e.labels.includes(label)))
      }
    }
    
    console.log(`[MockMailActionService] Found ${emails.length} emails matching filter`)
    return this.createSuccess(emails)
  }
  
  async listenToInbox(listener: Omit<InboxListener, 'id'>): Promise<MailActionResult<{ listenerId: string }>> {
    console.log('[MockMailActionService] listenToInbox called with filter:', listener.filter)
    
    const listenerId = this.generateId('listener')
    const fullListener: InboxListener = {
      ...listener,
      id: listenerId
    }
    
    this.inboxListeners.set(listenerId, fullListener)
    
    console.log(`[MockMailActionService] Started listening to inbox with ID: ${listenerId}`)
    
    // Simulate incoming emails
    setTimeout(() => {
      const newEmail: EmailMessage = {
        id: this.generateId('msg'),
        from: { email: 'new@example.com', name: 'New Sender' },
        to: [{ email: 'me@example.com' }],
        subject: 'New incoming email',
        body: 'This is a simulated new email',
        date: new Date(),
        labels: ['inbox'],
        isRead: false,
        hasAttachment: false,
        threadId: this.generateId('thread')
      }
      
      this.mockInbox.push(newEmail)
      
      // Notify listeners
      this.inboxListeners.forEach(l => {
        if (this.emailMatchesFilter(newEmail, l.filter)) {
          console.log(`[MockMailActionService] Notifying listener ${l.id} about new email`)
          l.callback(newEmail)
        }
      })
    }, 5000) // Simulate new email after 5 seconds
    
    return this.createSuccess({ listenerId })
  }
  
  async stopListening(listenerId: string): Promise<MailActionResult<void>> {
    console.log('[MockMailActionService] stopListening called:', listenerId)
    
    if (!this.inboxListeners.has(listenerId)) {
      return this.createError('NOT_FOUND', `Listener ${listenerId} not found`)
    }
    
    this.inboxListeners.delete(listenerId)
    console.log(`[MockMailActionService] Stopped listening with ID: ${listenerId}`)
    
    return this.createSuccess()
  }
  
  // Thread operations
  async getThread(threadId: string): Promise<MailActionResult<EmailMessage[]>> {
    console.log('[MockMailActionService] getThread called:', threadId)
    
    const threadEmails = this.mockInbox.filter(e => e.threadId === threadId)
    console.log(`[MockMailActionService] Found ${threadEmails.length} emails in thread ${threadId}`)
    
    return this.createSuccess(threadEmails)
  }
  
  async checkForResponse(originalMessageId: string): Promise<MailActionResult<EmailMessage[]>> {
    console.log('[MockMailActionService] checkForResponse called for message:', originalMessageId)
    
    const originalEmail = this.mockInbox.find(e => e.id === originalMessageId)
    if (!originalEmail) {
      return this.createError('NOT_FOUND', `Original message ${originalMessageId} not found`)
    }
    
    // Find responses in the same thread that came after the original
    const responses = this.mockInbox.filter(e => 
      e.threadId === originalEmail.threadId &&
      e.date > originalEmail.date &&
      e.id !== originalMessageId
    )
    
    console.log(`[MockMailActionService] Found ${responses.length} responses to message ${originalMessageId}`)
    return this.createSuccess(responses)
  }
  
  private emailMatchesFilter(email: EmailMessage, filter?: InboxListener['filter']): boolean {
    if (!filter) return true
    
    if (filter.from && !email.from.email.includes(filter.from)) return false
    if (filter.subject && !email.subject.toLowerCase().includes(filter.subject.toLowerCase())) return false
    if (filter.hasAttachment !== undefined && email.hasAttachment !== filter.hasAttachment) return false
    if (filter.labels && filter.labels.length > 0 && !filter.labels.some(label => email.labels.includes(label))) return false
    
    return true
  }
}