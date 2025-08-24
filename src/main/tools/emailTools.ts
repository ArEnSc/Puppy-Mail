import { tool } from '@lmstudio/sdk'
import { z } from 'zod'
import { UnifiedEmailService } from '../services/UnifiedEmailService'
import { Email, EmailFilter, EmailComposition } from '../../shared/types/email'
import { logInfo } from '../../shared/logger'

export const sendEmailTool = tool({
  name: 'sendEmail',
  description: 'Send a new email',
  parameters: {
    to: z.array(z.string()).describe('Array of recipient email addresses'),
    subject: z.string().describe('Email subject line'),
    body: z.string().describe('Email body content'),
    cc: z.array(z.string()).optional().describe('CC recipients'),
    bcc: z.array(z.string()).optional().describe('BCC recipients'),
    isHtml: z.boolean().optional().describe('Whether body is HTML formatted')
  },
  implementation: async (args) => {
    logInfo('[EmailTools] Sending email', args)

    const service = UnifiedEmailService.getInstance()
    if (!service) {
      return { success: false, error: 'Email service not initialized' }
    }

    const composition: EmailComposition = {
      to: args.to,
      cc: args.cc,
      bcc: args.bcc,
      subject: args.subject,
      body: args.body,
      isHtml: args.isHtml
    }

    const result = await service.sendEmail(composition)

    if (result.success) {
      return {
        success: true,
        messageId: result.messageId,
        message: `Email sent successfully to ${args.to.join(', ')}`
      }
    } else {
      return {
        success: false,
        error: result.error || 'Failed to send email'
      }
    }
  }
})

export const getEmailsTool = tool({
  name: 'getEmails',
  description: 'Retrieve emails based on filters',
  parameters: {
    from: z.string().optional().describe('Filter by sender email'),
    subject: z.string().optional().describe('Filter by subject'),
    isRead: z.boolean().optional().describe('Filter by read status'),
    isStarred: z.boolean().optional().describe('Filter by starred status'),
    limit: z.number().optional().describe('Maximum number of emails to return'),
    syncFromGmail: z.boolean().optional().describe('Whether to sync from Gmail first')
  },
  implementation: async (args) => {
    logInfo('[EmailTools] Getting emails', args)

    const service = UnifiedEmailService.getInstance()
    if (!service) {
      return { success: false, error: 'Email service not initialized' }
    }

    const filter: EmailFilter = {
      from: args.from,
      subject: args.subject,
      isRead: args.isRead,
      isStarred: args.isStarred,
      limit: args.limit || 50
    }

    try {
      let emails: Email[]

      if (args.syncFromGmail) {
        emails = await service.fetchEmails(filter, true)
      } else {
        emails = await service.getLocalEmails(filter)
      }

      return {
        success: true,
        count: emails.length,
        emails: emails.map((email) => ({
          id: email.id,
          from: `${email.from.name} <${email.from.email}>`,
          to: email.to.map((t) => t.email).join(', '),
          subject: email.subject,
          snippet: email.snippet,
          date: email.date.toISOString(),
          isRead: email.isRead,
          isStarred: email.isStarred,
          hasAttachments: email.attachments.length > 0
        }))
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get emails'
      }
    }
  }
})

export const markEmailAsReadTool = tool({
  name: 'markEmailAsRead',
  description: 'Mark an email as read',
  parameters: {
    emailId: z.string().describe('The ID of the email to mark as read')
  },
  implementation: async (args) => {
    logInfo('[EmailTools] Marking email as read', args)

    const service = UnifiedEmailService.getInstance()
    if (!service) {
      return { success: false, error: 'Email service not initialized' }
    }

    try {
      await service.updateEmailStatus(args.emailId, { isRead: true })
      return { success: true, message: 'Email marked as read' }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark email as read'
      }
    }
  }
})

export const toggleEmailStarTool = tool({
  name: 'toggleEmailStar',
  description: 'Toggle the starred status of an email',
  parameters: {
    emailId: z.string().describe('The ID of the email to toggle star')
  },
  implementation: async (args) => {
    logInfo('[EmailTools] Toggling email star', args)

    const service = UnifiedEmailService.getInstance()
    if (!service) {
      return { success: false, error: 'Email service not initialized' }
    }

    try {
      // Get current status
      const emails = await service.getLocalEmails({ limit: 1 })
      const email = emails.find((e) => e.id === args.emailId)

      if (!email) {
        return { success: false, error: 'Email not found' }
      }

      await service.updateEmailStatus(args.emailId, { isStarred: !email.isStarred })
      return {
        success: true,
        message: `Email ${!email.isStarred ? 'starred' : 'unstarred'}`
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle star'
      }
    }
  }
})

export const emailTools = [sendEmailTool, getEmailsTool, markEmailAsReadTool, toggleEmailStarTool]

export function getToolByName(name: string): (typeof emailTools)[number] | undefined {
  return emailTools.find((tool) => tool.name === name)
}

export function getAllTools(): typeof emailTools {
  return emailTools
}
