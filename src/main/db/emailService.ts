import { getDatabase, EmailDocument, AccountDocument } from './database'
import { gmail_v1 } from 'googleapis'

export class EmailService {
  static async syncEmails(accountId: string, emails: gmail_v1.Schema$Message[]): Promise<void> {
    const db = await getDatabase()

    const bulkData = emails.map((email) => ({
      id: email.id!,
      threadId: email.threadId || '',
      from: this.extractFrom(email),
      to: this.extractTo(email),
      subject: this.extractSubject(email),
      body: email.snippet || '',
      snippet: email.snippet || '',
      date: new Date(parseInt(email.internalDate || '0')),
      labels: email.labelIds || [],
      attachments: this.extractAttachments(email),
      isRead: !email.labelIds?.includes('UNREAD'),
      isStarred: email.labelIds?.includes('STARRED') || false,
      syncedAt: new Date()
    }))

    await db.emails.bulkUpsert(bulkData)
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
    const db = await getDatabase()
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

  // Helper methods
  private static extractFrom(email: gmail_v1.Schema$Message): string {
    const fromHeader = email.payload?.headers?.find((h) => h.name === 'From')
    return fromHeader?.value || ''
  }

  private static extractTo(email: gmail_v1.Schema$Message): string[] {
    const toHeader = email.payload?.headers?.find((h) => h.name === 'To')
    return toHeader?.value?.split(',').map((t) => t.trim()) || []
  }

  private static extractSubject(email: gmail_v1.Schema$Message): string {
    const subjectHeader = email.payload?.headers?.find((h) => h.name === 'Subject')
    return subjectHeader?.value || ''
  }

  private static extractAttachments(email: gmail_v1.Schema$Message): Array<{
    filename: string
    mimeType: string
    size: number
    attachmentId: string
  }> {
    const attachments: Array<{
      filename: string
      mimeType: string
      size: number
      attachmentId: string
    }> = []

    function processPayload(payload: gmail_v1.Schema$MessagePart): void {
      if (payload.filename && payload.body?.attachmentId) {
        attachments.push({
          filename: payload.filename,
          mimeType: payload.mimeType || '',
          size: payload.body.size || 0,
          attachmentId: payload.body.attachmentId
        })
      }

      if (payload.parts) {
        payload.parts.forEach(processPayload)
      }
    }

    if (email.payload) {
      processPayload(email.payload)
    }

    return attachments
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
