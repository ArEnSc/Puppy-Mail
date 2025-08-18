import { google, gmail_v1 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'

export interface EmailConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  refreshToken: string
  whitelistedEmails: string[]
}

export interface Email {
  id: string
  threadId: string
  from: string
  to: string
  subject: string
  body: string
  date: Date
  snippet: string
  attachments: Array<{
    filename: string
    mimeType: string
    size: number
    attachmentId: string
  }>
}

export interface FormattedEmail {
  id: string
  sender: string
  subject: string
  preview: string
  timestamp: string
  hasAttachments: boolean
}

export async function createGmailClient(config: EmailConfig): Promise<gmail_v1.Gmail> {
  const oauth2Client = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri)

  oauth2Client.setCredentials({
    refresh_token: config.refreshToken
  })

  return google.gmail({ version: 'v1', auth: oauth2Client })
}

export async function pollEmailsWithClient(gmail: gmail_v1.Gmail, maxResults: number = 10, whitelistedEmails: string[] = []): Promise<Email[]> {
  try {
    // Build query for whitelisted emails
    const fromQuery = whitelistedEmails.length > 0 
      ? whitelistedEmails.map((email) => `from:${email}`).join(' OR ')
      : undefined

    const query = fromQuery ? `{${fromQuery}}` : ''

    // List messages
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults
    })

    if (!response.data.messages) {
      return []
    }

    // Fetch full message details
    const emails: Email[] = await Promise.all(
      response.data.messages.map(async (message) => {
        if (!message.id) throw new Error('Message ID is missing')

        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        })

        return parseGmailMessage(fullMessage.data)
      })
    )

    return emails
  } catch (error) {
    console.error('Error polling emails:', error)
    throw new Error(
      `Failed to poll emails: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export async function pollEmails(config: EmailConfig, maxResults: number = 10): Promise<Email[]> {
  const gmail = await createGmailClient(config)
  return pollEmailsWithClient(gmail, maxResults, config.whitelistedEmails)
}

function parseGmailMessage(message: gmail_v1.Schema$Message): Email {
  if (!message.payload) {
    throw new Error('Message payload is missing')
  }

  const headers = message.payload.headers || []
  const getHeader = (name: string): string =>
    headers.find(
      (h: gmail_v1.Schema$MessagePartHeader) => h.name?.toLowerCase() === name.toLowerCase()
    )?.value || ''

  const body = extractBody(message.payload)
  const attachments = extractAttachments(message.payload)

  return {
    id: message.id || '',
    threadId: message.threadId || '',
    from: getHeader('From'),
    to: getHeader('To'),
    subject: getHeader('Subject'),
    body,
    date: new Date(parseInt(message.internalDate || '0')),
    snippet: message.snippet || '',
    attachments
  }
}

function extractBody(payload: gmail_v1.Schema$MessagePart): string {
  let body = ''

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body += Buffer.from(part.body.data, 'base64').toString('utf-8')
      } else if (part.mimeType === 'text/html' && !body && part.body?.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf-8')
      } else if (part.parts) {
        body += extractBody(part)
      }
    }
  } else if (payload.body?.data) {
    body = Buffer.from(payload.body.data, 'base64').toString('utf-8')
  }

  return body
}

function extractAttachments(payload: gmail_v1.Schema$MessagePart): Email['attachments'] {
  const attachments: Email['attachments'] = []

  function processPayload(part: gmail_v1.Schema$MessagePart): void {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || '',
        size: part.body.size || 0,
        attachmentId: part.body.attachmentId
      })
    }

    if (part.parts) {
      part.parts.forEach(processPayload)
    }
  }

  processPayload(payload)
  return attachments
}

export function formatEmail(email: Email): FormattedEmail {
  const senderMatch = email.from.match(/<(.+)>/) || email.from.match(/(.+)/)
  const sender = senderMatch ? senderMatch[1] : email.from

  return {
    id: email.id,
    sender,
    subject: email.subject,
    preview: email.snippet.substring(0, 100) + (email.snippet.length > 100 ? '...' : ''),
    timestamp: email.date.toISOString(),
    hasAttachments: email.attachments.length > 0
  }
}
