import { tool, Chat } from '@lmstudio/sdk'
import { LMStudioClient } from '@lmstudio/sdk'
import { z } from 'zod'
import { UnifiedEmailService } from '../services/UnifiedEmailService'
import { Email, EmailFilter, EmailComposition } from '../../shared/types/email'
import { logInfo, logError } from '../../shared/logger'

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

// Define a simple tool for the analysis LLM to use
const jsonResponseTool = tool({
  name: 'provide_analysis_result',
  description: 'Provide the analysis result in JSON format',
  parameters: {
    result: z.string().describe('The complete analysis result')
  },
  implementation: async (args) => {
    // This just returns the result - the actual work is done by the LLM
    return { result: args.result }
  }
})

export const analysisTool = tool({
  name: 'analysis',
  description: 'Analyze email content using an LLM and return structured results',
  parameters: {
    emailBody: z.string().describe('The email body content to analyze'),
    analysisPrompt: z.string().describe('The specific analysis prompt/question about the email')
  },
  implementation: async (args) => {
    logInfo('[AnalysisTool] Analyzing email with prompt:', args.analysisPrompt)
    logInfo('[AnalysisTool] Analyzing email with prompt:', args.emailBody)
    try {
      // Create a new LM Studio client for analysis
      const client = new LMStudioClient({ baseUrl: 'ws://localhost:1234' })

      // Get loaded models
      const models = await client.llm.listLoaded()
      if (models.length === 0) {
        return {
          error: 'No models loaded in LM Studio'
        }
      }

      // Use the first available model
      const model = models[0]

      // Create a new chat session for this analysis
      const analysisChat = Chat.empty()

      // Add system prompt that includes the analysis prompt
      analysisChat.append(
        'system',
        `You are a helpful email analysis assistant. Your task is to analyze emails based on the following prompt: "${args.analysisPrompt}"

When you complete your analysis, you MUST use the provide_analysis_result tool to return your findings. 

IMPORTANT: Always call the provide_analysis_result tool with your complete analysis as the result parameter.`
      )

      // Add the email content for analysis
      analysisChat.append(
        'user',
        `Here is the email to analyze:

${args.emailBody}

Please analyze this email and use the provide_analysis_result tool to return your analysis.`
      )

      let toolCallResult: any = null

      // Use act() with the jsonResponseTool
      await model.act(analysisChat, [jsonResponseTool], {
        onMessage: (message) => {
          // Append each message to maintain the conversation context
          analysisChat.append(message)

          // Log the message for debugging
          logInfo('[AnalysisTool] Message received:', {
            role: message.getRole(),
            content: message.getText(),
            toolCalls: message.getToolCallRequests()
          })
        },
        onToolCallRequestFinalized: (roundIndex, callId, info) => {
          // Capture the tool call result
          if (info.toolCallRequest.name === 'provide_analysis_result') {
            toolCallResult = info.toolCallRequest.arguments
          }
        }
      })

      // Check if we got a result
      if (!toolCallResult) {
        return {
          error: 'LLM did not use the required tool to provide analysis'
        }
      }

      return toolCallResult
    } catch (error) {
      logError('[AnalysisTool] Analysis error:', error)

      // Always return JSON, even for errors
      return {
        error: error instanceof Error ? error.message : 'Analysis failed',
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
      }
    }
  }
})

export const emailTools = [sendEmailTool, getEmailsTool, analysisTool]

export function getToolByName(name: string): (typeof emailTools)[number] | undefined {
  return emailTools.find((tool) => tool.name === name)
}

export function getAllTools(): typeof emailTools {
  return emailTools
}
