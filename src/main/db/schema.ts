import { RxJsonSchema } from 'rxdb'

export const emailSchema: RxJsonSchema<{
  id: string
  threadId: string
  from: string
  to: string[]
  subject: string
  body: string
  snippet: string
  date: Date
  labels: string[]
  attachments: Array<{
    filename: string
    mimeType: string
    size: number
    attachmentId: string
  }>
  isRead: boolean
  isStarred: boolean
  syncedAt: Date
}> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100
    },
    threadId: {
      type: 'string',
      maxLength: 100
    },
    from: {
      type: 'string'
    },
    to: {
      type: 'array',
      items: {
        type: 'string'
      }
    },
    subject: {
      type: 'string'
    },
    body: {
      type: 'string'
    },
    snippet: {
      type: 'string'
    },
    date: {
      type: 'string',
      format: 'date-time'
    },
    labels: {
      type: 'array',
      items: {
        type: 'string'
      }
    },
    attachments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          filename: {
            type: 'string'
          },
          mimeType: {
            type: 'string'
          },
          size: {
            type: 'number'
          },
          attachmentId: {
            type: 'string'
          }
        }
      }
    },
    isRead: {
      type: 'boolean'
    },
    isStarred: {
      type: 'boolean'
    },
    syncedAt: {
      type: 'string',
      format: 'date-time'
    }
  },
  required: [
    'id',
    'threadId',
    'from',
    'to',
    'subject',
    'body',
    'snippet',
    'date',
    'labels',
    'attachments',
    'isRead',
    'isStarred',
    'syncedAt'
  ],
  indexes: ['date', 'from', 'isRead', 'isStarred', 'threadId']
}

export const accountSchema: RxJsonSchema<{
  id: string
  email: string
  provider: 'gmail' | 'outlook' | 'other'
  accessToken: string
  refreshToken: string
  expiresAt: Date
  lastSync: Date
  isActive: boolean
}> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100
    },
    email: {
      type: 'string'
    },
    provider: {
      type: 'string',
      enum: ['gmail', 'outlook', 'other']
    },
    accessToken: {
      type: 'string'
    },
    refreshToken: {
      type: 'string'
    },
    expiresAt: {
      type: 'string',
      format: 'date-time'
    },
    lastSync: {
      type: 'string',
      format: 'date-time'
    },
    isActive: {
      type: 'boolean'
    }
  },
  required: [
    'id',
    'email',
    'provider',
    'accessToken',
    'refreshToken',
    'expiresAt',
    'lastSync',
    'isActive'
  ]
}
