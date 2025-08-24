import { logInfo, logError } from '../../../shared/logger'

// Email types
export interface EmailAddress {
  name: string
  email: string
}

export interface Email {
  id: string
  threadId: string
  from: EmailAddress
  to: EmailAddress[]
  cc?: EmailAddress[]
  subject: string
  snippet: string
  body: string
  date: Date
  attachments: Array<{
    id: string
    filename: string
    mimeType: string
    size: number
  }>
  labels: string[]
  isRead: boolean
  isStarred: boolean
  isImportant: boolean
}

export interface EmailComposition {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  attachments?: Array<{
    filename: string
    content: Buffer
    mimeType: string
  }>
}

export interface EmailFilter {
  from?: string
  to?: string
  subject?: string
  labels?: string[]
  dateFrom?: Date
  dateTo?: Date
  isRead?: boolean
  isStarred?: boolean
  limit?: number
}

export interface EmailListenOptions {
  pollInterval?: number // in minutes
  filter?: EmailFilter
}

// Service interfaces
export interface EmailProvider {
  sendEmail(composition: EmailComposition): Promise<{ success: boolean; messageId?: string; error?: string }>
  fetchEmails(filter?: EmailFilter): Promise<Email[]>
  startListening(options: EmailListenOptions, callback: (emails: Email[]) => void): string
  stopListening(listenerId: string): void
}

export interface EmailRepository {
  saveEmails(emails: Email[]): Promise<void>
  getEmails(filter?: EmailFilter): Promise<Email[]>
  updateEmail(id: string, updates: Partial<Email>): Promise<void>
  deleteEmail(id: string): Promise<void>
  clearAll(): Promise<void>
}

// Main EmailService class
export class EmailService {
  private provider: EmailProvider
  private repository: EmailRepository
  private listeners: Map<string, { intervalId: NodeJS.Timeout; callback: (emails: Email[]) => void }> = new Map()

  constructor(provider: EmailProvider, repository: EmailRepository) {
    this.provider = provider
    this.repository = repository
  }

  /**
   * Send an email through the provider
   */
  async sendEmail(composition: EmailComposition): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      logInfo('[EmailService] Sending email', { to: composition.to, subject: composition.subject })
      const result = await this.provider.sendEmail(composition)
      
      if (result.success) {
        logInfo('[EmailService] Email sent successfully', { messageId: result.messageId })
      } else {
        logError('[EmailService] Failed to send email', { error: result.error })
      }
      
      return result
    } catch (error) {
      logError('[EmailService] Error sending email:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Fetch emails from provider and sync to local database
   */
  async getEmails(options?: { filter?: EmailFilter; syncToDb?: boolean }): Promise<{ success: boolean; emails?: Email[]; error?: string }> {
    try {
      const { filter, syncToDb = true } = options || {}
      
      logInfo('[EmailService] Fetching emails from provider', { filter })
      const emails = await this.provider.fetchEmails(filter)
      
      if (syncToDb && emails.length > 0) {
        logInfo('[EmailService] Syncing emails to database', { count: emails.length })
        await this.repository.saveEmails(emails)
      }
      
      logInfo('[EmailService] Successfully fetched emails', { count: emails.length })
      return { success: true, emails }
    } catch (error) {
      logError('[EmailService] Error fetching emails:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Listen for new emails and trigger callback
   */
  async listenForEmails(
    filter: EmailFilter | undefined,
    callback: (emails: Email[]) => void
  ): Promise<{ success: boolean; listenerId?: string; error?: string }> {
    try {
      const listenerId = `listener-${Date.now()}`
      const pollInterval = 5 // default 5 minutes
      
      logInfo('[EmailService] Starting email listener', { listenerId, pollInterval })
      
      // Initial fetch
      const initialResult = await this.getEmails({ filter })
      if (initialResult.success && initialResult.emails) {
        callback(initialResult.emails)
      }
      
      // Set up polling
      const intervalId = setInterval(async () => {
        const result = await this.getEmails({ filter })
        if (result.success && result.emails && result.emails.length > 0) {
          callback(result.emails)
        }
      }, pollInterval * 60 * 1000)
      
      this.listeners.set(listenerId, { intervalId, callback })
      
      logInfo('[EmailService] Email listener started', { listenerId })
      return { success: true, listenerId }
    } catch (error) {
      logError('[EmailService] Error starting email listener:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Stop listening for emails
   */
  stopListening(listenerId: string): void {
    const listener = this.listeners.get(listenerId)
    if (listener) {
      clearInterval(listener.intervalId)
      this.listeners.delete(listenerId)
      logInfo('[EmailService] Stopped email listener', { listenerId })
    }
  }

  /**
   * Analyze emails from local database (for AI)
   */
  async analyzeEmails(
    emailFilter: EmailFilter | undefined,
    prompt: string
  ): Promise<{ success: boolean; analysis?: string; emails?: Email[]; error?: string }> {
    try {
      logInfo('[EmailService] Analyzing emails from database', { filter: emailFilter, prompt })
      
      // Always read from local database for AI analysis
      const emails = await this.repository.getEmails(emailFilter)
      
      if (emails.length === 0) {
        return { success: true, analysis: 'No emails found matching the criteria', emails: [] }
      }
      
      // Here you would integrate with your AI service
      // For now, returning a placeholder
      const analysis = `Found ${emails.length} emails for analysis. AI analysis would be performed here with prompt: "${prompt}"`
      
      logInfo('[EmailService] Email analysis complete', { emailCount: emails.length })
      return { success: true, analysis, emails }
    } catch (error) {
      logError('[EmailService] Error analyzing emails:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Get emails from local database only (no provider sync)
   */
  async getLocalEmails(filter?: EmailFilter): Promise<Email[]> {
    return this.repository.getEmails(filter)
  }

  /**
   * Update email in local database
   */
  async updateLocalEmail(id: string, updates: Partial<Email>): Promise<void> {
    return this.repository.updateEmail(id, updates)
  }

  /**
   * Clear all listeners
   */
  clearAllListeners(): void {
    for (const [listenerId, listener] of this.listeners) {
      clearInterval(listener.intervalId)
    }
    this.listeners.clear()
    logInfo('[EmailService] Cleared all email listeners')
  }
}