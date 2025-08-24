import { EmailService } from './email/emailService'
import { logInfo } from '../../shared/logger'
import {
  EmailComposition,
  ScheduledEmail,
  LabelOperation,
  EmailMessage
} from '../../types/mailActions'

class MailActionService {
  private emailService: EmailService | null = null

  setEmailService(emailService: EmailService): void {
    this.emailService = emailService
    logInfo('[MailActionService] Email service configured')
  }

  async sendEmail(
    composition: EmailComposition
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.emailService) {
      return { success: false, error: 'Email service not configured' }
    }

    // Convert EmailComposition to the format expected by EmailService
    const emailServiceComposition = {
      to: composition.to.map((addr) => addr.email),
      cc: composition.cc?.map((addr) => addr.email),
      bcc: composition.bcc?.map((addr) => addr.email),
      subject: composition.subject,
      body: composition.body,
      attachments: composition.attachments?.map((path) => ({
        filename: path.split('/').pop() || 'attachment',
        content: Buffer.from(''), // Would need to read file
        mimeType: 'application/octet-stream'
      }))
    }

    return this.emailService.sendEmail(emailServiceComposition)
  }

  async scheduleEmail(
    _scheduled: ScheduledEmail
  ): Promise<{ success: boolean; scheduledId?: string; error?: string }> {
    // TODO: Implement email scheduling
    return { success: false, error: 'Email scheduling not yet implemented' }
  }

  async updateLabels(_operation: LabelOperation): Promise<{ success: boolean; error?: string }> {
    // TODO: Implement label operations
    return { success: false, error: 'Label operations not yet implemented' }
  }

  // Add missing methods
  async addLabels(
    _emailId: string,
    _labelIds: string[]
  ): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: 'Label operations not yet implemented' }
  }

  async removeLabels(
    _emailId: string,
    _labelIds: string[]
  ): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: 'Label operations not yet implemented' }
  }

  async listenToInbox(
    _filter: any,
    _callback: (emails: EmailMessage[]) => void
  ): Promise<{ success: boolean; listenerId?: string; error?: string }> {
    return { success: false, error: 'Inbox listening not yet implemented' }
  }

  async getEmails(
    filter?: any
  ): Promise<{ success: boolean; emails?: EmailMessage[]; error?: string }> {
    if (!this.emailService) {
      return { success: false, error: 'Email service not configured' }
    }

    const result = await this.emailService.getEmails({ filter })
    if (result.success && result.emails) {
      // Convert to EmailMessage format
      const emailMessages: EmailMessage[] = result.emails.map((email) => ({
        id: email.id,
        from: email.from,
        to: email.to,
        cc: email.cc,
        subject: email.subject,
        body: email.body,
        date: email.date,
        labels: email.labels,
        isRead: email.isRead,
        isStarred: email.isStarred,
        hasAttachment: email.attachments.length > 0,
        threadId: email.threadId
      }))
      return { success: true, emails: emailMessages }
    }
    return { success: false, error: result.error }
  }

  async listenForEmails(
    filter: any,
    callback: (emails: EmailMessage[]) => void
  ): Promise<{ success: boolean; listenerId?: string; error?: string }> {
    if (!this.emailService) {
      return { success: false, error: 'Email service not configured' }
    }

    return this.emailService.listenForEmails(filter, (emails) => {
      const emailMessages: EmailMessage[] = emails.map((email) => ({
        id: email.id,
        from: email.from,
        to: email.to,
        cc: email.cc,
        subject: email.subject,
        body: email.body,
        date: email.date,
        labels: email.labels,
        isRead: email.isRead,
        isStarred: email.isStarred,
        hasAttachment: email.attachments.length > 0,
        threadId: email.threadId
      }))
      callback(emailMessages)
    })
  }

  async analyzeEmails(
    filter: any,
    prompt: string
  ): Promise<{ success: boolean; analysis?: string; emails?: EmailMessage[]; error?: string }> {
    if (!this.emailService) {
      return { success: false, error: 'Email service not configured' }
    }

    const result = await this.emailService.analyzeEmails(filter, prompt)
    if (result.success && result.emails) {
      const emailMessages: EmailMessage[] = result.emails.map((email) => ({
        id: email.id,
        from: email.from,
        to: email.to,
        cc: email.cc,
        subject: email.subject,
        body: email.body,
        date: email.date,
        labels: email.labels,
        isRead: email.isRead,
        isStarred: email.isStarred,
        hasAttachment: email.attachments.length > 0,
        threadId: email.threadId
      }))
      return { success: true, analysis: result.analysis, emails: emailMessages }
    }
    return { success: false, error: result.error }
  }
}

// Singleton instance
const mailActionService = new MailActionService()

export function getMailActionService(): MailActionService {
  return mailActionService
}

export function configureMailActionService(emailService: EmailService): void {
  mailActionService.setEmailService(emailService)
}
