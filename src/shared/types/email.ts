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
