import { getDatabase, EmailDocument, AccountDocument } from './database'
import { Email } from '../emailManager'

export class EmailService {
  static async syncEmails(accountId: string, emails: Email[]): Promise<void> {
    try {
      console.log(`syncEmails: Starting sync for account ${accountId} with ${emails.length} emails`)
      const db = await getDatabase()
      if (!db) {
        console.error('syncEmails: Database not available, cannot sync emails')
        return
      }

      // For each email, check if it exists and preserve local modifications
      const bulkData = await Promise.all(
        emails.map(async (email) => {
          // Try to find existing email in database
          const existingEmail = await db.emails.findOne(email.id).exec()

          if (existingEmail) {
            // Email exists - preserve local modifications (read/starred status)
            return {
              id: String(email.id),
              threadId: String(email.threadId),
              from: String(email.from),
              to: email.to.split(',').map((t) => t.trim()),
              subject: String(email.subject),
              body: String(email.body),
              snippet: String(email.snippet),
              date: email.date.toISOString(),
              labels: email.labels,
              attachments: email.attachments,
              // Preserve local state
              isRead: existingEmail.isRead,
              isStarred: existingEmail.isStarred,
              syncedAt: new Date().toISOString()
            }
          } else {
            // New email - use data from Gmail
            return {
              id: String(email.id),
              threadId: String(email.threadId),
              from: String(email.from),
              to: email.to.split(',').map((t) => t.trim()),
              subject: String(email.subject),
              body: String(email.body),
              snippet: String(email.snippet),
              date: email.date.toISOString(),
              labels: email.labels,
              attachments: email.attachments,
              isRead: email.isRead,
              isStarred: email.isStarred,
              syncedAt: new Date().toISOString()
            }
          }
        })
      )

      await db.emails.bulkUpsert(bulkData)
      console.log(
        `syncEmails: Successfully synced ${bulkData.length} emails, preserving local state`
      )
    } catch (error) {
      console.error('syncEmails: Error syncing emails to database:', error)
      console.error('syncEmails: Error details:', {
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
      console.log(`getEmails: Fetching emails with limit=${limit}, offset=${offset}`)
      const db = await getDatabase()
      if (!db) {
        console.error('getEmails: Database not available, returning empty array')
        return []
      }
      let query = db.emails.find()

      if (filters?.isRead !== undefined) {
        query = query.where('isRead').eq(filters.isRead)
      }
      if (filters?.isStarred !== undefined) {
        query = query.where('isStarred').eq(filters.isStarred)
      }
      if (filters?.from) {
        query = query.where('from').regex(new RegExp(filters.from, 'i'))
      }

      const results = await query.sort({ date: 'desc' }).skip(offset).limit(limit).exec()

      console.log(`getEmails: Found ${results.length} emails`)
      return results
    } catch (error) {
      console.error('getEmails: Error getting emails from database:', error)
      console.error('getEmails: Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      return []
    }
  }

  static async markAsRead(emailId: string): Promise<void> {
    try {
      console.log(`markAsRead: Marking email ${emailId} as read`)
      const db = await getDatabase()
      if (!db) {
        console.error('markAsRead: Database not available')
        return
      }
      const email = await db.emails.findOne(emailId).exec()
      if (email) {
        await email.update({
          $set: {
            isRead: true
          }
        })
        console.log(`markAsRead: Successfully marked email ${emailId} as read`)
      } else {
        console.warn(`markAsRead: Email ${emailId} not found`)
      }
    } catch (error) {
      console.error(`markAsRead: Error marking email ${emailId} as read:`, error)
      console.error('markAsRead: Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
    }
  }

  static async toggleStar(emailId: string): Promise<void> {
    try {
      console.log(`toggleStar: Toggling star for email ${emailId}`)
      const db = await getDatabase()
      if (!db) {
        console.error('toggleStar: Database not available')
        return
      }
      const email = await db.emails.findOne(emailId).exec()
      if (email) {
        const newStarred = !email.isStarred
        await email.update({
          $set: {
            isStarred: newStarred
          }
        })
        console.log(`toggleStar: Successfully set star to ${newStarred} for email ${emailId}`)
      } else {
        console.warn(`toggleStar: Email ${emailId} not found`)
      }
    } catch (error) {
      console.error(`toggleStar: Error toggling star for email ${emailId}:`, error)
      console.error('toggleStar: Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
    }
  }

  static async deleteEmail(emailId: string): Promise<void> {
    const db = await getDatabase()
    const email = await db.emails.findOne(emailId).exec()
    if (email) {
      await email.remove()
    }
  }

  static async searchEmails(searchTerm: string): Promise<EmailDocument[]> {
    const db = await getDatabase()
    const results = await db.emails
      .find({
        $or: [
          { subject: { $regex: searchTerm, $options: 'i' } },
          { body: { $regex: searchTerm, $options: 'i' } },
          { from: { $regex: searchTerm, $options: 'i' } }
        ]
      })
      .sort({ date: 'desc' })
      .exec()

    return results
  }
}

export class AccountService {
  static async saveAccount(accountData: {
    email: string
    provider: 'gmail' | 'outlook' | 'other'
    accessToken: string
    refreshToken: string
    expiresAt: Date
  }): Promise<AccountDocument> {
    const db = await getDatabase()

    const account = await db.accounts.upsert({
      id: accountData.email,
      email: accountData.email,
      provider: accountData.provider,
      accessToken: accountData.accessToken,
      refreshToken: accountData.refreshToken,
      expiresAt: accountData.expiresAt,
      lastSync: new Date(),
      isActive: true
    })

    return account
  }

  static async getActiveAccounts(): Promise<AccountDocument[]> {
    const db = await getDatabase()
    const accounts = await db.accounts
      .find({
        selector: {
          isActive: true
        }
      })
      .exec()

    return accounts
  }

  static async updateTokens(
    accountId: string,
    accessToken: string,
    expiresAt: Date
  ): Promise<void> {
    const db = await getDatabase()
    const account = await db.accounts.findOne(accountId).exec()

    if (account) {
      await account.update({
        $set: {
          accessToken,
          expiresAt
        }
      })
    }
  }

  static async deactivateAccount(accountId: string): Promise<void> {
    const db = await getDatabase()
    const account = await db.accounts.findOne(accountId).exec()

    if (account) {
      await account.update({
        $set: {
          isActive: false
        }
      })
    }
  }
}
