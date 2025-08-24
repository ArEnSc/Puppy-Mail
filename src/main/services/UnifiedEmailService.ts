import { gmail_v1 } from 'googleapis'
import { ipcMain, BrowserWindow } from 'electron'
import { GmailAuthService } from '../auth/authService'
import { getDatabase, EmailDocument } from '../db/database'
import {
  Email,
  EmailFilter,
  EmailComposition,
  EmailAddress,
  EmailAttachment,
  EMAIL_IPC_CHANNELS
} from '../../shared/types/email'
import { logInfo, logError } from '../../shared/logger'
import { getCleanEmail } from '../utils/emailSanitizer'

/**
 * Unified email service that handles all email operations
 * Combines functionality from EmailService, GmailService, EmailRepository, and MailActionService
 */
export class UnifiedEmailService {
  private static instance: UnifiedEmailService | null = null
  private gmailAuthService: GmailAuthService
  private pollingInterval: NodeJS.Timeout | null = null
  private lastSyncTime: Date | null = null

  private constructor(gmailAuthService: GmailAuthService) {
    this.gmailAuthService = gmailAuthService
    this.setupIpcHandlers()
  }

  /**
   * Get or create the singleton instance
   */
  static initialize(gmailAuthService: GmailAuthService): UnifiedEmailService {
    if (!UnifiedEmailService.instance) {
      UnifiedEmailService.instance = new UnifiedEmailService(gmailAuthService)
      logInfo('[UnifiedEmailService] Service initialized')
    }
    return UnifiedEmailService.instance
  }

  static getInstance(): UnifiedEmailService | null {
    return UnifiedEmailService.instance
  }

  // ============================================
  // Core Email Operations
  // ============================================

  /**
   * Send an email via Gmail
   */
  async sendEmail(
    composition: EmailComposition
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      logInfo('[UnifiedEmailService] Sending email', {
        to: composition.to,
        subject: composition.subject
      })

      const gmail = await this.gmailAuthService.getGmailClient()
      const message = this.buildRawMessage(composition)

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '')
        }
      })

      logInfo('[UnifiedEmailService] Email sent successfully', { messageId: response.data.id })
      return { success: true, messageId: response.data.id || undefined }
    } catch (error) {
      logError('[UnifiedEmailService] Error sending email:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email'
      }
    }
  }

  /**
   * Fetch emails from Gmail and optionally sync to database
   */
  async fetchEmails(filter?: EmailFilter, syncToDb = true): Promise<Email[]> {
    try {
      logInfo('[UnifiedEmailService] Fetching emails', { filter, syncToDb })

      const gmail = await this.gmailAuthService.getGmailClient()
      const query = this.buildGmailQuery(filter)
      const maxResults = filter?.limit || 100

      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults
      })

      const messages = listResponse.data.messages || []
      const emails: Email[] = []

      // Fetch full details for each message
      for (const message of messages) {
        if (!message.id) continue

        try {
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: message.id
          })

          const email = this.parseGmailMessage(fullMessage.data)
          if (email) {
            emails.push(email)
          }
        } catch (error) {
          logError(`[UnifiedEmailService] Error fetching message ${message.id}:`, error)
        }
      }

      // Sync to database if requested
      if (syncToDb && emails.length > 0) {
        await this.saveToDatabase(emails)
      }

      logInfo(`[UnifiedEmailService] Fetched ${emails.length} emails`)
      return emails
    } catch (error) {
      logError('[UnifiedEmailService] Error fetching emails:', error)
      throw error
    }
  }

  /**
   * Get emails from local database
   */
  async getLocalEmails(filter?: EmailFilter): Promise<Email[]> {
    try {
      const db = await getDatabase()
      if (!db) {
        logError('[UnifiedEmailService] Database not available')
        return []
      }

      let query = db.objects<EmailDocument>('Email')

      // Apply filters
      if (filter?.isRead !== undefined) {
        query = query.filtered('isRead = $0', filter.isRead)
      }
      if (filter?.isStarred !== undefined) {
        query = query.filtered('isStarred = $0', filter.isStarred)
      }
      if (filter?.from) {
        query = query.filtered('from CONTAINS[c] $0', filter.from)
      }
      if (filter?.labels && filter.labels.length > 0) {
        for (const label of filter.labels) {
          query = query.filtered('labels CONTAINS $0', label)
        }
      }

      // Sort by date descending
      query = query.sorted('date', true)

      // Apply pagination
      const limit = filter?.limit || 300
      const offset = filter?.offset || 0
      const results = Array.from(query.slice(offset, offset + limit))

      return results.map((doc) => this.documentToEmail(doc))
    } catch (error) {
      logError('[UnifiedEmailService] Error getting local emails:', error)
      return []
    }
  }

  /**
   * Update email status in database
   */
  async updateEmailStatus(emailId: string, updates: Partial<Email>): Promise<void> {
    try {
      const db = await getDatabase()
      if (!db) return

      db.write(() => {
        const email = db.objectForPrimaryKey<EmailDocument>('Email', emailId)
        if (email) {
          if (updates.isRead !== undefined) email.isRead = updates.isRead
          if (updates.isStarred !== undefined) email.isStarred = updates.isStarred
          if (updates.isImportant !== undefined) email.isImportant = updates.isImportant
          if (updates.labels) email.labels = updates.labels
          logInfo(`[UnifiedEmailService] Updated email ${emailId}`)
        }
      })
    } catch (error) {
      logError(`[UnifiedEmailService] Error updating email ${emailId}:`, error)
    }
  }

  /**
   * Start polling for new emails
   */
  startPolling(intervalMinutes = 5, filter?: EmailFilter): void {
    this.stopPolling() // Stop any existing polling

    logInfo('[UnifiedEmailService] Starting email polling', { intervalMinutes })

    // Initial fetch
    this.fetchEmails(filter, true)
      .then((emails) => {
        this.broadcastNewEmails(emails)
      })
      .catch((error) => {
        logError('[UnifiedEmailService] Error in initial fetch:', error)
      })

    // Set up interval
    this.pollingInterval = setInterval(
      async () => {
        try {
          const emails = await this.fetchEmails(filter, true)
          this.broadcastNewEmails(emails)
        } catch (error) {
          logError('[UnifiedEmailService] Error in polling:', error)
        }
      },
      intervalMinutes * 60 * 1000
    )
  }

  /**
   * Stop polling for emails
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
      logInfo('[UnifiedEmailService] Stopped email polling')
    }
  }

  // ============================================
  // Database Operations
  // ============================================

  private async saveToDatabase(emails: Email[]): Promise<void> {
    try {
      const db = await getDatabase()
      if (!db) return

      db.write(() => {
        for (const email of emails) {
          const existingEmail = db.objectForPrimaryKey<EmailDocument>('Email', email.id)

          const emailDoc = {
            id: email.id,
            threadId: email.threadId,
            from: `${email.from.name} <${email.from.email}>`,
            to: email.to.map((t) => `${t.name} <${t.email}>`),
            subject: email.subject,
            body: email.body,
            snippet: email.snippet,
            date: email.date,
            labels: email.labels,
            attachments: email.attachments.map((att) => ({
              attachmentId: att.id,
              filename: att.filename,
              mimeType: att.mimeType,
              size: att.size
            })),
            isRead: existingEmail ? existingEmail.isRead : email.isRead,
            isStarred: existingEmail ? existingEmail.isStarred : email.isStarred,
            isImportant: email.isImportant,
            syncedAt: new Date()
          }

          if (existingEmail) {
            Object.assign(existingEmail, emailDoc)
          } else {
            db.create<EmailDocument>('Email', emailDoc)
          }
        }
      })

      logInfo(`[UnifiedEmailService] Saved ${emails.length} emails to database`)
    } catch (error) {
      logError('[UnifiedEmailService] Error saving to database:', error)
    }
  }

  private documentToEmail(doc: EmailDocument): Email {
    // Parse from address
    const fromMatch = doc.from.match(/(.*?)\s*<(.+?)>/) || [null, doc.from, doc.from]
    const [, fromName, fromEmail] = fromMatch

    // Parse to addresses
    const to = Array.from(doc.to).map((addr) => {
      const match = addr.match(/(.*?)\s*<(.+?)>/) || [null, addr, addr]
      const [, name, email] = match
      return { name: name?.trim() || email, email }
    })

    return {
      id: doc.id,
      threadId: doc.threadId,
      from: {
        name: fromName?.trim() || fromEmail,
        email: fromEmail
      },
      to,
      subject: doc.subject,
      snippet: doc.snippet,
      body: doc.body,
      date: doc.date,
      attachments: Array.from(doc.attachments).map((att) => {
        const attachment = att as {
          attachmentId: string
          filename: string
          mimeType: string
          size: number
        }
        return {
          id: attachment.attachmentId,
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          size: attachment.size
        }
      }),
      labels: Array.from(doc.labels),
      isRead: doc.isRead,
      isStarred: doc.isStarred,
      isImportant: doc.isImportant,
      syncedAt: doc.syncedAt
    }
  }

  // ============================================
  // Gmail Helpers
  // ============================================

  private buildRawMessage(composition: EmailComposition): string {
    const lines: string[] = []

    lines.push(`To: ${composition.to.join(', ')}`)
    if (composition.cc && composition.cc.length > 0) {
      lines.push(`Cc: ${composition.cc.join(', ')}`)
    }
    if (composition.bcc && composition.bcc.length > 0) {
      lines.push(`Bcc: ${composition.bcc.join(', ')}`)
    }
    lines.push(`Subject: ${composition.subject}`)
    lines.push(
      composition.isHtml
        ? 'Content-Type: text/html; charset=UTF-8'
        : 'Content-Type: text/plain; charset=UTF-8'
    )
    lines.push('')
    lines.push(composition.body)

    return lines.join('\r\n')
  }

  private buildGmailQuery(filter?: EmailFilter): string {
    if (!filter) return ''

    const parts: string[] = []

    if (filter.from) parts.push(`from:${filter.from}`)
    if (filter.to) parts.push(`to:${filter.to}`)
    if (filter.subject) parts.push(`subject:${filter.subject}`)
    if (filter.query) parts.push(filter.query)

    if (filter.labels && filter.labels.length > 0) {
      parts.push(...filter.labels.map((label) => `label:${label}`))
    }

    if (filter.isRead !== undefined) {
      parts.push(filter.isRead ? 'is:read' : 'is:unread')
    }
    if (filter.isStarred !== undefined) {
      parts.push(filter.isStarred ? 'is:starred' : '-is:starred')
    }

    if (filter.dateFrom) {
      parts.push(`after:${Math.floor(filter.dateFrom.getTime() / 1000)}`)
    }
    if (filter.dateTo) {
      parts.push(`before:${Math.floor(filter.dateTo.getTime() / 1000)}`)
    }

    return parts.join(' ')
  }

  private parseGmailMessage(message: gmail_v1.Schema$Message): Email | null {
    if (!message.id || !message.threadId) return null

    const headers = message.payload?.headers || []
    const getHeader = (name: string): string =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || ''

    // Parse addresses
    const from = this.parseEmailAddress(getHeader('from'))
    const to = this.parseEmailAddresses(getHeader('to'))
    const cc = getHeader('cc') ? this.parseEmailAddresses(getHeader('cc')) : undefined

    // Extract body and attachments
    const body = this.extractBody(message.payload) || ''
    const attachments = this.extractAttachments(message.payload)

    // Get labels
    const labels = message.labelIds || []

    return {
      id: message.id,
      threadId: message.threadId,
      from,
      to,
      cc,
      subject: getHeader('subject'),
      snippet: message.snippet || '',
      body,
      date: new Date(parseInt(message.internalDate || '0')),
      attachments,
      labels,
      isRead: !labels.includes('UNREAD'),
      isStarred: labels.includes('STARRED'),
      isImportant: labels.includes('IMPORTANT')
    }
  }

  private parseEmailAddress(address: string): EmailAddress {
    const match = address.match(/(.*?)\s*<(.+?)>/)
    if (match) {
      return {
        name: match[1].trim() || match[2],
        email: match[2]
      }
    }
    return {
      name: address,
      email: address
    }
  }

  private parseEmailAddresses(addresses: string): EmailAddress[] {
    return addresses.split(',').map((addr) => this.parseEmailAddress(addr.trim()))
  }

  private extractBody(payload?: gmail_v1.Schema$MessagePart): string | null {
    if (!payload) return null

    const findBody = (part: gmail_v1.Schema$MessagePart, mimeType: string): string | null => {
      if (part.mimeType === mimeType && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8')
      }

      if (part.parts) {
        for (const subPart of part.parts) {
          const body = findBody(subPart, mimeType)
          if (body) return body
        }
      }

      return null
    }

    return findBody(payload, 'text/html') || findBody(payload, 'text/plain') || ''
  }

  private extractAttachments(payload?: gmail_v1.Schema$MessagePart): EmailAttachment[] {
    const attachments: EmailAttachment[] = []

    const findAttachments = (part: gmail_v1.Schema$MessagePart): void => {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          id: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body.size || 0
        })
      }

      if (part.parts) {
        for (const subPart of part.parts) {
          findAttachments(subPart)
        }
      }
    }

    if (payload) {
      findAttachments(payload)
    }

    return attachments
  }

  // ============================================
  // IPC Handlers
  // ============================================

  private setupIpcHandlers(): void {
    // Fetch emails from database
    ipcMain.handle(EMAIL_IPC_CHANNELS.EMAIL_FETCH, async () => {
      try {
        const emails = await this.getLocalEmails({ limit: 300 })
        return emails.map((email) => this.transformForRenderer(email))
      } catch (error) {
        logError('[UnifiedEmailService] IPC fetch error:', error)
        return []
      }
    })

    // Sync emails from Gmail
    ipcMain.handle(EMAIL_IPC_CHANNELS.EMAIL_SYNC, async () => {
      try {
        await this.fetchEmails({ limit: 300 }, true)
        this.lastSyncTime = new Date()

        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send(EMAIL_IPC_CHANNELS.EMAIL_SYNC_COMPLETE, {
            timestamp: this.lastSyncTime,
            success: true
          })
        })

        return { success: true, timestamp: this.lastSyncTime }
      } catch (error) {
        logError('[UnifiedEmailService] IPC sync error:', error)
        throw error
      }
    })

    // Start polling
    ipcMain.handle(EMAIL_IPC_CHANNELS.EMAIL_START_POLLING, async (_, intervalMinutes?: number) => {
      try {
        this.startPolling(intervalMinutes || 5)
        return { success: true }
      } catch (error) {
        logError('[UnifiedEmailService] IPC polling error:', error)
        throw error
      }
    })

    // Stop polling
    ipcMain.handle(EMAIL_IPC_CHANNELS.EMAIL_STOP_POLLING, async () => {
      this.stopPolling()
      return { success: true }
    })

    // Mark as read
    ipcMain.handle(EMAIL_IPC_CHANNELS.EMAIL_MARK_AS_READ, async (_, emailId: string) => {
      await this.updateEmailStatus(emailId, { isRead: true })
      return { success: true }
    })

    // Toggle star
    ipcMain.handle(EMAIL_IPC_CHANNELS.EMAIL_TOGGLE_STAR, async (_, emailId: string) => {
      const emails = await this.getLocalEmails({ limit: 1 })
      const email = emails.find((e) => e.id === emailId)

      if (email) {
        await this.updateEmailStatus(emailId, { isStarred: !email.isStarred })
      }

      return { success: true }
    })

    // Clear all emails
    ipcMain.handle(EMAIL_IPC_CHANNELS.EMAIL_CLEAR_ALL, async () => {
      try {
        const database = await getDatabase()
        if (database) {
          const emails = database.objects(EmailDocument)
          database.write(() => {
            database.delete(emails)
          })
        }
        return { success: true }
      } catch (error) {
        logError('[UnifiedEmailService] Clear all emails error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to clear emails'
        }
      }
    })

    // Send email
    ipcMain.handle('email:send', async (_, composition: EmailComposition) => {
      return this.sendEmail(composition)
    })

    logInfo('[UnifiedEmailService] IPC handlers registered')
  }

  private transformForRenderer(
    email: Email
  ): Email & { cleanBody: string; categorizedAttachments: Record<string, EmailAttachment[]> } {
    const cleanEmail = getCleanEmail(email.body, email.attachments)

    return {
      id: email.id,
      threadId: email.threadId,
      subject: email.subject,
      from: email.from,
      to: email.to,
      cc: email.cc || [],
      date: email.date,
      body: email.body,
      cleanBody: cleanEmail.text,
      snippet: email.snippet,
      labels: email.labels,
      isRead: email.isRead,
      isStarred: email.isStarred,
      isImportant: email.isImportant,
      attachments: email.attachments,
      categorizedAttachments: cleanEmail.attachments
    }
  }

  private broadcastNewEmails(emails: Email[]): void {
    const transformedEmails = emails.map((email) => this.transformForRenderer(email))

    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send(EMAIL_IPC_CHANNELS.EMAIL_NEW_EMAILS, transformedEmails)
    })
  }
}
