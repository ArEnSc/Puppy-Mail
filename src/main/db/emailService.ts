import { getDatabase, EmailDocument, AccountDocument } from './database'
import { Email } from '../services/email/emailManager'
import { logInfo, logError, logWarning } from '../../shared/logger'

export class EmailService {
  static async syncEmails(accountId: string, emails: Email[]): Promise<void> {
    try {
      logInfo(`syncEmails: Starting sync for account ${accountId} with ${emails.length} emails`)
      const db = await getDatabase()
      if (!db) {
        logError('syncEmails: Database not available, cannot sync emails')
        return
      }

      // Use a write transaction for bulk operations
      db.write(() => {
        emails.forEach((email) => {
          // Check if email exists
          const existingEmail = db.objectForPrimaryKey<EmailDocument>('Email', email.id)

          if (existingEmail) {
            // Email exists - preserve local modifications (read/starred status)
            existingEmail.threadId = email.threadId
            existingEmail.from = email.from
            existingEmail.to = email.to.split(',').map((t) => t.trim())
            existingEmail.subject = email.subject
            existingEmail.body = email.body
            existingEmail.snippet = email.snippet
            existingEmail.date = email.date
            existingEmail.labels = email.labels
            existingEmail.attachments = email.attachments
            existingEmail.isImportant = email.labels.includes('IMPORTANT')
            existingEmail.syncedAt = new Date()
            // Preserve local state - don't update isRead and isStarred
          } else {
            // New email - create it
            db.create<EmailDocument>('Email', {
              id: email.id,
              threadId: email.threadId,
              from: email.from,
              to: email.to.split(',').map((t) => t.trim()),
              subject: email.subject,
              body: email.body,
              snippet: email.snippet,
              date: email.date,
              labels: email.labels,
              attachments: email.attachments,
              isRead: email.isRead,
              isStarred: email.isStarred,
              isImportant: email.labels.includes('IMPORTANT'),
              syncedAt: new Date()
            })
          }
        })
      })

      logInfo(`syncEmails: Successfully synced ${emails.length} emails, preserving local state`)
    } catch (error) {
      logError('syncEmails: Error syncing emails to database:', error)
      logError('syncEmails: Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      // Don't throw - we want the app to continue working even if DB fails
    }
  }

  static async getEmails(
    limit = 50,
    offset = 0,
    filters?: {
      isRead?: boolean
      isStarred?: boolean
      from?: string
      label?: string
    }
  ): Promise<EmailDocument[]> {
    try {
      logInfo(`getEmails: Fetching emails with limit=${limit}, offset=${offset}`)
      const db = await getDatabase()
      if (!db) {
        logError('getEmails: Database not available, returning empty array')
        return []
      }

      let query = db.objects<EmailDocument>('Email')

      // Apply filters
      if (filters?.isRead !== undefined) {
        query = query.filtered('isRead = $0', filters.isRead)
      }
      if (filters?.isStarred !== undefined) {
        query = query.filtered('isStarred = $0', filters.isStarred)
      }
      if (filters?.from) {
        query = query.filtered('from CONTAINS[c] $0', filters.from)
      }
      if (filters?.label) {
        query = query.filtered('labels CONTAINS $0', filters.label)
      }

      // Sort by date descending
      query = query.sorted('date', true)

      // Apply pagination
      const results = Array.from(query.slice(offset, offset + limit))

      logInfo(`getEmails: Found ${results.length} emails`)
      return results
    } catch (error) {
      logError('getEmails: Error getting emails from database:', error)
      logError('getEmails: Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      return []
    }
  }

  static async markAsRead(emailId: string): Promise<void> {
    try {
      logInfo(`markAsRead: Marking email ${emailId} as read`)
      const db = await getDatabase()
      if (!db) {
        logError('markAsRead: Database not available')
        return
      }

      db.write(() => {
        const email = db.objectForPrimaryKey<EmailDocument>('Email', emailId)
        if (email) {
          email.isRead = true
          logInfo(`markAsRead: Successfully marked email ${emailId} as read`)
        } else {
          logWarning(`markAsRead: Email ${emailId} not found`)
        }
      })
    } catch (error) {
      logError(`markAsRead: Error marking email ${emailId} as read:`, error)
      logError('markAsRead: Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
    }
  }

  static async toggleStar(emailId: string): Promise<void> {
    try {
      logInfo(`toggleStar: Toggling star for email ${emailId}`)
      const db = await getDatabase()
      if (!db) {
        logError('toggleStar: Database not available')
        return
      }

      db.write(() => {
        const email = db.objectForPrimaryKey<EmailDocument>('Email', emailId)
        if (email) {
          const newStarred = !email.isStarred
          email.isStarred = newStarred
          logInfo(`toggleStar: Successfully set star to ${newStarred} for email ${emailId}`)
        } else {
          logWarning(`toggleStar: Email ${emailId} not found`)
        }
      })
    } catch (error) {
      logError(`toggleStar: Error toggling star for email ${emailId}:`, error)
      logError('toggleStar: Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
    }
  }

  static async deleteEmail(emailId: string): Promise<void> {
    try {
      const db = await getDatabase()
      if (!db) {
        logError('deleteEmail: Database not available')
        return
      }

      db.write(() => {
        const email = db.objectForPrimaryKey<EmailDocument>('Email', emailId)
        if (email) {
          db.delete(email)
          logInfo(`deleteEmail: Successfully deleted email ${emailId}`)
        }
      })
    } catch (error) {
      logError(`deleteEmail: Error deleting email ${emailId}:`, error)
    }
  }

  static async searchEmails(searchTerm: string): Promise<EmailDocument[]> {
    try {
      const db = await getDatabase()
      if (!db) {
        return []
      }

      const results = db
        .objects<EmailDocument>('Email')
        .filtered(
          'subject CONTAINS[c] $0 OR body CONTAINS[c] $0 OR from CONTAINS[c] $0',
          searchTerm
        )
        .sorted('date', true)

      return Array.from(results)
    } catch (error) {
      logError('searchEmails: Error searching emails:', error)
      return []
    }
  }

  static async clearAllEmails(): Promise<void> {
    try {
      logInfo('clearAllEmails: Starting to clear all emails from database')
      const db = await getDatabase()
      if (!db) {
        logError('clearAllEmails: Database not available')
        return
      }

      db.write(() => {
        const allEmails = db.objects<EmailDocument>('Email')
        const emailCount = allEmails.length
        db.delete(allEmails)
        logInfo(`clearAllEmails: Successfully deleted ${emailCount} emails`)
      })
    } catch (error) {
      logError('clearAllEmails: Error clearing all emails:', error)
      logError('clearAllEmails: Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
    }
  }
}

export class AccountService {
  static async saveAccount(accountData: {
    email: string
    provider: 'gmail' | 'outlook' | 'other'
    accessToken: string
    refreshToken: string
    expiresAt: Date
  }): Promise<AccountDocument | null> {
    try {
      const db = await getDatabase()
      if (!db) {
        return null
      }

      let account: AccountDocument | null = null

      db.write(() => {
        account = db.create<AccountDocument>(
          'Account',
          {
            id: accountData.email,
            email: accountData.email,
            provider: accountData.provider,
            accessToken: accountData.accessToken,
            refreshToken: accountData.refreshToken,
            expiresAt: accountData.expiresAt,
            lastSync: new Date(),
            isActive: true
          },
          Realm.UpdateMode.Modified
        ) // Upsert mode
      })

      return account
    } catch (error) {
      logError('saveAccount: Error saving account:', error)
      return null
    }
  }

  static async getActiveAccounts(): Promise<AccountDocument[]> {
    try {
      const db = await getDatabase()
      if (!db) {
        return []
      }

      const accounts = db.objects<AccountDocument>('Account').filtered('isActive = true')

      return Array.from(accounts)
    } catch (error) {
      logError('getActiveAccounts: Error getting accounts:', error)
      return []
    }
  }

  static async updateTokens(
    accountId: string,
    accessToken: string,
    expiresAt: Date
  ): Promise<void> {
    try {
      const db = await getDatabase()
      if (!db) {
        return
      }

      db.write(() => {
        const account = db.objectForPrimaryKey<AccountDocument>('Account', accountId)
        if (account) {
          account.accessToken = accessToken
          account.expiresAt = expiresAt
        }
      })
    } catch (error) {
      logError('updateTokens: Error updating tokens:', error)
    }
  }

  static async deactivateAccount(accountId: string): Promise<void> {
    try {
      const db = await getDatabase()
      if (!db) {
        return
      }

      db.write(() => {
        const account = db.objectForPrimaryKey<AccountDocument>('Account', accountId)
        if (account) {
          account.isActive = false
        }
      })
    } catch (error) {
      logError('deactivateAccount: Error deactivating account:', error)
    }
  }
}
