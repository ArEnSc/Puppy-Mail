import { gmail_v1 } from 'googleapis'
import { GmailAuthService } from '../../auth/authService'
import { EmailProvider, Email, EmailComposition, EmailFilter, EmailListenOptions, EmailAddress } from '../email/emailService'
import { logInfo, logError } from '../../../shared/logger'

export class GmailService implements EmailProvider {
  private authService: GmailAuthService
  private activeListeners: Map<string, NodeJS.Timeout> = new Map()

  constructor(authService: GmailAuthService) {
    this.authService = authService
  }

  async sendEmail(composition: EmailComposition): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const gmail = await this.authService.getGmailClient()
      
      // Build email message
      const message = this.buildEmailMessage(composition)
      
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
        }
      })
      
      return { success: true, messageId: response.data.id || undefined }
    } catch (error) {
      logError('[GmailService] Error sending email:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send email' 
      }
    }
  }

  async fetchEmails(filter?: EmailFilter): Promise<Email[]> {
    try {
      const gmail = await this.authService.getGmailClient()
      
      // Build query from filter
      const query = this.buildQuery(filter)
      const maxResults = filter?.limit || 100
      
      logInfo('[GmailService] Fetching emails with query:', { query, maxResults })
      
      // List messages
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
          logError(`[GmailService] Error fetching message ${message.id}:`, error)
        }
      }
      
      logInfo(`[GmailService] Fetched ${emails.length} emails`)
      return emails
    } catch (error) {
      logError('[GmailService] Error fetching emails:', error)
      throw error
    }
  }

  startListening(options: EmailListenOptions, callback: (emails: Email[]) => void): string {
    const listenerId = `gmail-${Date.now()}`
    const pollInterval = options.pollInterval || 5 // default 5 minutes
    
    logInfo('[GmailService] Starting listener', { listenerId, pollInterval })
    
    // Initial fetch
    this.fetchEmails(options.filter).then(emails => {
      if (emails.length > 0) {
        callback(emails)
      }
    }).catch(error => {
      logError('[GmailService] Error in initial fetch:', error)
    })
    
    // Set up polling
    const intervalId = setInterval(async () => {
      try {
        const emails = await this.fetchEmails(options.filter)
        if (emails.length > 0) {
          callback(emails)
        }
      } catch (error) {
        logError('[GmailService] Error in polling:', error)
      }
    }, pollInterval * 60 * 1000)
    
    this.activeListeners.set(listenerId, intervalId)
    return listenerId
  }

  stopListening(listenerId: string): void {
    const intervalId = this.activeListeners.get(listenerId)
    if (intervalId) {
      clearInterval(intervalId)
      this.activeListeners.delete(listenerId)
      logInfo('[GmailService] Stopped listener', { listenerId })
    }
  }

  private buildEmailMessage(composition: EmailComposition): string {
    const lines: string[] = []
    
    lines.push(`To: ${composition.to.join(', ')}`)
    if (composition.cc && composition.cc.length > 0) {
      lines.push(`Cc: ${composition.cc.join(', ')}`)
    }
    if (composition.bcc && composition.bcc.length > 0) {
      lines.push(`Bcc: ${composition.bcc.join(', ')}`)
    }
    lines.push(`Subject: ${composition.subject}`)
    lines.push('Content-Type: text/html; charset=UTF-8')
    lines.push('')
    lines.push(composition.body)
    
    return lines.join('\r\n')
  }

  private buildQuery(filter?: EmailFilter): string {
    if (!filter) return ''
    
    const parts: string[] = []
    
    if (filter.from) {
      parts.push(`from:${filter.from}`)
    }
    if (filter.to) {
      parts.push(`to:${filter.to}`)
    }
    if (filter.subject) {
      parts.push(`subject:${filter.subject}`)
    }
    if (filter.labels && filter.labels.length > 0) {
      parts.push(...filter.labels.map(label => `label:${label}`))
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
    const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || ''
    
    // Parse from address
    const fromHeader = getHeader('from')
    const from = this.parseEmailAddress(fromHeader)
    
    // Parse to addresses
    const toHeader = getHeader('to')
    const to = this.parseEmailAddresses(toHeader)
    
    // Parse cc addresses
    const ccHeader = getHeader('cc')
    const cc = ccHeader ? this.parseEmailAddresses(ccHeader) : undefined
    
    // Get body
    const body = this.extractBody(message.payload) || ''
    
    // Get attachments
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
        name: match[1].trim().replace(/^"|"$/g, ''),
        email: match[2]
      }
    }
    return {
      name: address,
      email: address
    }
  }

  private parseEmailAddresses(addresses: string): EmailAddress[] {
    return addresses.split(',').map(addr => this.parseEmailAddress(addr.trim()))
  }

  private extractBody(payload?: gmail_v1.Schema$MessagePart): string | null {
    if (!payload) return null
    
    // Check for plain text first, then HTML
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

  private extractAttachments(payload?: gmail_v1.Schema$MessagePart): Array<{ id: string; filename: string; mimeType: string; size: number }> {
    const attachments: Array<{ id: string; filename: string; mimeType: string; size: number }> = []
    
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
}