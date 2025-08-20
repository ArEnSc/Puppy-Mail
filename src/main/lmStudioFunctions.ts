// Function definitions for LM Studio function calling
import type { EmailComposition, LabelOperation, EmailMessage } from '../types/mailActions'
import { EmailService } from './db/emailService'
import { getMailActionService } from './services/mailActionServiceManager'

export interface FunctionDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<
      string,
      {
        type: string
        description: string
        enum?: string[]
        items?: {
          type: string
        }
      }
    >
    required?: string[]
  }
}

export interface FunctionCall {
  name: string
  arguments: string // JSON string of arguments
}

// Define available functions
export const availableFunctions: FunctionDefinition[] = [
  // Email send operations
  {
    name: 'sendEmail',
    description: 'Send a new email',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'array',
          description: 'Array of recipient email addresses',
          items: {
            type: 'string'
          }
        },
        subject: {
          type: 'string',
          description: 'Email subject line'
        },
        body: {
          type: 'string',
          description: 'Email body content'
        },
        cc: {
          type: 'array',
          description: 'Array of CC recipient email addresses',
          items: {
            type: 'string'
          }
        },
        bcc: {
          type: 'array',
          description: 'Array of BCC recipient email addresses',
          items: {
            type: 'string'
          }
        },
        isHtml: {
          type: 'boolean',
          description: 'Whether the body is HTML formatted'
        }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'scheduleEmail',
    description: 'Schedule an email to be sent later',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'array',
          description: 'Array of recipient email addresses',
          items: {
            type: 'string'
          }
        },
        subject: {
          type: 'string',
          description: 'Email subject line'
        },
        body: {
          type: 'string',
          description: 'Email body content'
        },
        scheduledTime: {
          type: 'string',
          description: 'ISO 8601 date string for when to send'
        }
      },
      required: ['to', 'subject', 'body', 'scheduledTime']
    }
  },
  // Label operations
  {
    name: 'addLabels',
    description: 'Add labels to an email',
    parameters: {
      type: 'object',
      properties: {
        emailId: {
          type: 'string',
          description: 'ID of the email'
        },
        labelIds: {
          type: 'array',
          description: 'Array of label IDs to add',
          items: {
            type: 'string'
          }
        }
      },
      required: ['emailId', 'labelIds']
    }
  },
  {
    name: 'removeLabels',
    description: 'Remove labels from an email',
    parameters: {
      type: 'object',
      properties: {
        emailId: {
          type: 'string',
          description: 'ID of the email'
        },
        labelIds: {
          type: 'array',
          description: 'Array of label IDs to remove',
          items: {
            type: 'string'
          }
        }
      },
      required: ['emailId', 'labelIds']
    }
  },
  {
    name: 'listenForEmails',
    description: 'Start listening for new emails from specific senders',
    parameters: {
      type: 'object',
      properties: {
        from: {
          type: 'array',
          description: 'Array of email addresses to monitor for incoming emails',
          items: {
            type: 'string'
          }
        },
        subject: {
          type: 'string',
          description: 'Optional subject filter (emails containing this text)'
        },
        labels: {
          type: 'array',
          description: 'Optional array of label IDs to filter by',
          items: {
            type: 'string'
          }
        },
        notificationMessage: {
          type: 'string',
          description: 'Message to show when a matching email arrives'
        }
      },
      required: ['from']
    }
  },
  {
    name: 'analysis',
    description: 'Run analysis on data using an LLM prompt',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The analysis prompt/question to run'
        },
        includeRecentEmails: {
          type: 'boolean',
          description: 'Whether to include recent emails in the analysis context'
        },
        emailCount: {
          type: 'number',
          description: 'Number of recent emails to include (if includeRecentEmails is true)'
        },
        customData: {
          type: 'object',
          description: 'Additional custom data to include in the analysis'
        }
      },
      required: ['prompt']
    }
  }
]

// Get mail action service instance
const mailActionService = getMailActionService()

// Function implementations
export const functionImplementations: Record<string, (args: unknown) => unknown> = {
  // Email send operations
  sendEmail: async (args: unknown) => {
    const params = args as {
      to: string[]
      subject: string
      body: string
      cc?: string[]
      bcc?: string[]
      isHtml?: boolean
    }
    console.log('[Function Call] sendEmail:', params)

    // Convert string arrays to EmailAddress arrays
    const composition: EmailComposition = {
      to: params.to.map((email) => ({ email })),
      cc: params.cc?.map((email) => ({ email })),
      bcc: params.bcc?.map((email) => ({ email })),
      subject: params.subject,
      body: params.body,
      isHtml: params.isHtml
    }

    return await mailActionService.sendEmail(composition)
  },
  scheduleEmail: async (args: unknown) => {
    const params = args as { to: string[]; subject: string; body: string; scheduledTime: string }
    console.log('[Function Call] scheduleEmail:', params)

    const scheduledEmail = {
      to: params.to.map((email) => ({ email })),
      subject: params.subject,
      body: params.body,
      scheduledTime: new Date(params.scheduledTime)
    }

    return await mailActionService.scheduleEmail(scheduledEmail)
  },
  // Label operations
  addLabels: async (args: unknown) => {
    const params = args as { emailId: string; labelIds: string[] }
    console.log('[Function Call] addLabels:', params)
    const operation: LabelOperation = {
      emailId: params.emailId,
      labelIds: params.labelIds,
      operation: 'add'
    }
    return await mailActionService.addLabels(operation)
  },
  removeLabels: async (args: unknown) => {
    const params = args as { emailId: string; labelIds: string[] }
    console.log('[Function Call] removeLabels:', params)
    const operation: LabelOperation = {
      emailId: params.emailId,
      labelIds: params.labelIds,
      operation: 'remove'
    }
    return await mailActionService.removeLabels(operation)
  },
  listenForEmails: async (args: unknown) => {
    const params = args as {
      from: string[]
      subject?: string
      labels?: string[]
      notificationMessage?: string
    }
    console.log('[Function Call] listenForEmails:', params)

    const result = await mailActionService.listenForEmails(params.from, {
      subject: params.subject,
      labels: params.labels,
      callback: (email) => {
        console.log('[Email Received] From:', email.from, 'Subject:', email.subject)
        console.log('[Notification]', params.notificationMessage || 'New email received from monitored sender')
      }
    })

    if (result.success) {
      return {
        success: true,
        message: `Now monitoring emails from: ${params.from.join(', ')}`,
        listenerId: result.data
      }
    }
    return result
  },
  analysis: async (args: unknown) => {
    const params = args as {
      prompt: string
      includeRecentEmails?: boolean
      emailCount?: number
      customData?: Record<string, unknown>
    }
    console.log('[Function Call] analysis:', params)

    // Build context for analysis
    const context: { emails?: EmailMessage[]; data?: Record<string, unknown> } = {}
    
    if (params.includeRecentEmails) {
      // Get recent emails from the database
      const emails = await EmailService.getEmails(params.emailCount || 10, 0)
      context.emails = emails
    }
    
    if (params.customData) {
      context.data = params.customData
    }

    const result = await mailActionService.analysis(params.prompt, context)
    
    if (result.success) {
      return {
        success: true,
        result: result.data,
        message: typeof result.data === 'string' 
          ? 'Analysis completed' 
          : `Analysis completed with ${result.data.length} results`
      }
    }
    return result
  }
}

// Execute a function call
export async function executeFunction(functionCall: FunctionCall): Promise<{
  success: boolean
  result?: unknown
  error?: string
}> {
  try {
    const func = functionImplementations[functionCall.name]
    if (!func) {
      return {
        success: false,
        error: `Function ${functionCall.name} not found`
      }
    }

    const args = JSON.parse(functionCall.arguments)
    const result = await func(args)

    return {
      success: true,
      result
    }
  } catch (error) {
    console.error(`[Function Execution Error] ${functionCall.name}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Function execution failed'
    }
  }
}

// Format functions for the LM Studio prompt
export function formatFunctionsForPrompt(functions: FunctionDefinition[]): string {
  console.log('[formatFunctionsForPrompt] Called with', functions.length, 'functions')

  const prompt = `You have access to the following functions:

${functions
  .map(
    (f) => `Function: ${f.name}
Description: ${f.description}
Parameters: ${JSON.stringify(f.parameters, null, 2)}`
  )
  .join('\n\n')}

IMPORTANT INSTRUCTIONS FOR FUNCTION USAGE:

1. **Ask for clarification**: If the user's request is missing required parameters or is ambiguous, ASK for clarification before calling any function. For example:
   - If user says "send an email", ask for recipient, subject, and body
   - If user says "schedule an email", ask for recipient, subject, body, and when to send it
   - If user says "monitor emails", ask which email addresses to monitor
   
   EXCEPTION: If the user explicitly asks you to "fill in the details yourself" or "make it up" or similar phrasing, then generate reasonable placeholder content and execute the function without asking for clarification.

2. **Validate before execution**: Check that you have all required parameters before calling a function.

3. **Summarize what you did**: After calling a function, provide a clear summary of:
   - What function was called
   - What parameters were used
   - What the result was (success or error)
   - Any relevant details from the response

4. **Handle errors gracefully**: If a function returns an error, explain what went wrong and suggest how to fix it.

To use a function, you can either:
1. Use the special format: <|channel|>commentary to=functions.functionName <|message|>{"param1": value1, "param2": value2}
2. Or respond with: {"function_call": {"name": "function_name", "arguments": "{\\"param1\\": value1, \\"param2\\": value2}"}}

Examples:
- To send an email: <|channel|>commentary to=functions.sendEmail <|message|>{"to": ["user@example.com"], "subject": "Hello", "body": "Hi there!"}
- To add labels: <|channel|>commentary to=functions.addLabels <|message|>{"emailId": "email-123", "labelIds": ["label-1", "label-2"]}
- To analyze data: <|channel|>commentary to=functions.analysis <|message|>{"prompt": "Summarize my recent emails", "includeRecentEmails": true, "emailCount": 5}

Remember: Always ask for missing information before executing functions!`

  console.log('[formatFunctionsForPrompt] Generated prompt of length:', prompt.length)
  console.log('[formatFunctionsForPrompt] Full prompt:\n', prompt)
  return prompt
}
