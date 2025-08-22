import { tool } from '@lmstudio/sdk'
import { z } from 'zod'
import type { EmailComposition, EmailMessage } from '../types/mailActions'
import type { EmailDocument } from './db/database'
import { EmailService } from './db/emailService'
import { getMailActionService } from './services/mailActionServiceManager'
const mailActionService = getMailActionService()

export const sendEmailTool = tool({
  name: 'sendEmail',
  description: 'Send a new email',
  parameters: {
    to: z.array(z.string()).describe('Array of recipient email addresses'),
    subject: z.string().describe('Email subject line'),
    body: z.string().describe('Email body content'),
    cc: z.array(z.string()).optional().describe('Array of CC recipient email addresses'),
    bcc: z.array(z.string()).optional().describe('Array of BCC recipient email addresses'),
    isHtml: z.boolean().optional().describe('Whether the body is HTML formatted')
  },
  implementation: async ({ to, subject, body, cc, bcc, isHtml }) => {
    console.log('[LM Studio Tool] sendEmail:', { to, subject, body, cc, bcc, isHtml })

    const composition: EmailComposition = {
      to: to.map((email) => ({ email })),
      cc: cc?.map((email) => ({ email })),
      bcc: bcc?.map((email) => ({ email })),
      subject,
      body,
      isHtml
    }

    const result = await mailActionService.sendEmail(composition)
    return {
      success: result.success,
      messageId: result.data?.messageId,
      message: result.success
        ? 'Email sent successfully'
        : result.error?.message || 'Failed to send email'
    }
  }
})

export const scheduleEmailTool = tool({
  name: 'scheduleEmail',
  description: 'Schedule an email to be sent later',
  parameters: {
    to: z.array(z.string()).describe('Array of recipient email addresses'),
    subject: z.string().describe('Email subject line'),
    body: z.string().describe('Email body content'),
    scheduledTime: z.string().describe('ISO 8601 date string for when to send')
  },
  implementation: async ({ to, subject, body, scheduledTime }) => {
    console.log('[LM Studio Tool] scheduleEmail:', { to, subject, body, scheduledTime })

    const scheduledEmail = {
      to: to.map((email) => ({ email })),
      subject,
      body,
      scheduledTime: new Date(scheduledTime)
    }

    const result = await mailActionService.scheduleEmail(scheduledEmail)
    return {
      success: result.success,
      scheduledId: result.data?.scheduledId,
      message: result.success
        ? 'Email scheduled successfully'
        : result.error?.message || 'Failed to schedule email'
    }
  }
})

export const listenForEmailsTool = tool({
  name: 'listenForEmails',
  description: 'Start listening for new emails from specific senders',
  parameters: {
    from: z.array(z.string()).describe('Array of email addresses to monitor for incoming emails'),
    subject: z
      .string()
      .optional()
      .describe('Optional subject filter (emails containing this text)'),
    labels: z.array(z.string()).optional().describe('Optional array of label IDs to filter by'),
    notificationMessage: z
      .string()
      .optional()
      .describe('Message to show when a matching email arrives')
  },
  implementation: async ({ from, subject, labels, notificationMessage }) => {
    console.log('[LM Studio Tool] listenForEmails:', { from, subject, labels, notificationMessage })

    const result = await mailActionService.listenForEmails(from, {
      subject,
      labels,
      callback: (email) => {
        console.log('[Email Received] From:', email.from, 'Subject:', email.subject)
        console.log(
          '[Notification]',
          notificationMessage || 'New email received from monitored sender'
        )
      }
    })

    if (result.success) {
      return {
        success: true,
        message: `Now monitoring emails from: ${from.join(', ')}`,
        listenerId: result.data
      }
    }
    return result
  }
})

export const analysisTool = tool({
  name: 'analysis',
  description: 'Run analysis on email content or data using an LLM prompt',
  parameters: {
    prompt: z.string().describe('The analysis prompt/question to run'),
    emailBody: z
      .string()
      .optional()
      .describe('The email body content to analyze (plain text or HTML)'),
    includeRecentEmails: z
      .boolean()
      .optional()
      .describe('Whether to include recent emails in the analysis context'),
    emailCount: z
      .number()
      .optional()
      .describe('Number of recent emails to include (if includeRecentEmails is true)'),
    customData: z
      .record(z.unknown())
      .optional()
      .describe('Additional custom data to include in the analysis')
  },
  implementation: async ({ prompt, emailBody, includeRecentEmails, emailCount, customData }) => {
    console.log('[LM Studio Tool] analysis:', {
      prompt,
      emailBodyLength: emailBody?.length,
      includeRecentEmails,
      emailCount,
      customData
    })

    // Build context for the LLM prompt
    let fullPrompt = prompt
    const context: { emails?: EmailMessage[]; data?: Record<string, unknown> } = {}

    // If email body is provided, include it in the prompt
    if (emailBody) {
      // Clean HTML if present
      const cleanBody = emailBody.replace(/<[^>]*>/g, '').trim()
      fullPrompt = `${prompt}\n\nEmail Content:\n${cleanBody}`
    }

    // Include recent emails if requested
    if (includeRecentEmails) {
      const emailDocs = await EmailService.getEmails(emailCount || 10, 0)
      // Convert EmailDocument[] to EmailMessage[]
      const emails: EmailMessage[] = emailDocs.map((doc) => ({
        id: doc.id,
        from: { email: doc.from, name: '' },
        to: doc.to.map((email) => ({ email, name: '' })),
        cc: [],
        subject: doc.subject,
        body: doc.body,
        date: doc.date,
        labels: doc.labels,
        isRead: doc.isRead,
        hasAttachment: doc.attachments && doc.attachments.length > 0,
        threadId: doc.threadId
      }))
      context.emails = emails
      fullPrompt += `\n\nContext: ${emails.length} recent emails included for analysis`
    }

    // Include custom data if provided
    if (customData) {
      context.data = customData
      fullPrompt += `\n\nAdditional Data: ${JSON.stringify(customData)}`
    }

    // Call the mail action service with the full prompt
    const result = await mailActionService.analysis(fullPrompt, context)

    // Return string result directly for the model to use
    if (result.success) {
      // If result.data is a string, return it directly
      // This allows the model to receive the analysis output
      return typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2)
    }

    // On failure, return error message
    return `Analysis failed: ${result.error?.message || 'Unknown error'}`
  }
})

export const lmStudioAgentTools = [
  sendEmailTool,
  scheduleEmailTool,
  listenForEmailsTool,
  analysisTool
]

export function getToolByName(name: string): (typeof lmStudioAgentTools)[number] | undefined {
  return lmStudioAgentTools.find((tool) => tool.name === name)
}

export function getAllTools(): typeof lmStudioAgentTools {
  return lmStudioAgentTools
}
