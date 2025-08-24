/**
 * Unified email types used throughout the application
 */

export interface EmailAddress {
  name: string
  email: string
}

export interface EmailAttachment {
  id: string
  filename: string
  mimeType: string
  size: number
}

export interface Email {
  // Core identifiers
  id: string
  threadId: string

  // Addresses
  from: EmailAddress
  to: EmailAddress[]
  cc?: EmailAddress[]
  bcc?: EmailAddress[]

  // Content
  subject: string
  snippet: string
  body: string

  // Metadata
  date: Date
  labels: string[]
  attachments: EmailAttachment[]

  // Status flags
  isRead: boolean
  isStarred: boolean
  isImportant: boolean

  // Local tracking
  syncedAt?: Date
}

export interface EmailFilter {
  // Search filters
  from?: string
  to?: string
  subject?: string
  query?: string

  // Label filters
  labels?: string[]

  // Status filters
  isRead?: boolean
  isStarred?: boolean
  isImportant?: boolean

  // Date filters
  dateFrom?: Date
  dateTo?: Date

  // Pagination
  limit?: number
  offset?: number
}

export interface EmailComposition {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  isHtml?: boolean
  attachments?: Array<{
    filename: string
    content: Buffer
    mimeType: string
  }>
}

export const EMAIL_IPC_CHANNELS = {
  // Email operations
  EMAIL_FETCH: 'email:fetch',
  EMAIL_SYNC: 'email:sync',
  EMAIL_START_POLLING: 'email:startPolling',
  EMAIL_STOP_POLLING: 'email:stopPolling',
  EMAIL_MARK_AS_READ: 'email:markAsRead',
  EMAIL_TOGGLE_STAR: 'email:toggleStar',
  EMAIL_CLEAR_ALL: 'email:clearAll',

  // Email events
  EMAIL_NEW_EMAILS: 'email:newEmails',
  EMAIL_SYNC_COMPLETE: 'email:syncComplete'
} as const

export type EmailIPCChannel = (typeof EMAIL_IPC_CHANNELS)[keyof typeof EMAIL_IPC_CHANNELS]
