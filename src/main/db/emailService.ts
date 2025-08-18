import { getDatabase, EmailDocument, AccountDocument } from './database'
import { Email } from '../emailManager'

export class EmailService {
  static async syncEmails(accountId: string, emails: Email[]): Promise<void> {
    try {
      const db = await getDatabase()
      if (!db) {
        console.warn('Database not available, skipping email sync')
        return
      }

      const bulkData = emails.map((email) => ({
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
      }))

      await db.emails.bulkUpsert(bulkData)
    } catch (error) {
      console.error('Error syncing emails to database:', error)
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
      const db = await getDatabase()
      if (!db) {
        console.warn('Database not available, returning empty array')
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

      return results
    } catch (error) {
      console.error('Error getting emails from database:', error)
      return []
    }
  }

  static async markAsRead(emailId: string): Promise<void> {
    const db = await getDatabase()
    const email = await db.emails.findOne(emailId).exec()
    if (email) {
      await email.update({
        $set: {
          isRead: true
        }
      })
    }
  }

  static async toggleStar(emailId: string): Promise<void> {
    const db = await getDatabase()
    const email = await db.emails.findOne(emailId).exec()
    if (email) {
      await email.update({
        $set: {
          isStarred: !email.isStarred
        }
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
