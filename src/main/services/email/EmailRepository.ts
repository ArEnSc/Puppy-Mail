import { EmailRepository as IEmailRepository, Email, EmailFilter } from './emailService'
import { getDatabase, EmailDocument } from '../../db/database'
import { logInfo, logError } from '../../../shared/logger'

export class EmailRepository implements IEmailRepository {
  async saveEmails(emails: Email[]): Promise<void> {
    try {
      logInfo(`[EmailRepository] Saving ${emails.length} emails to database`)
      const db = await getDatabase()
      if (!db) {
        logError('[EmailRepository] Database not available')
        return
      }

      db.write(() => {
        for (const email of emails) {
          // Check if email exists
          const existingEmail = db.objectForPrimaryKey<EmailDocument>('Email', email.id)
          
          if (existingEmail) {
            // Update existing email but preserve local state (read/starred)
            existingEmail.threadId = email.threadId
            existingEmail.from = `${email.from.name} <${email.from.email}>`
            existingEmail.to = email.to.map(t => `${t.name} <${t.email}>`)
            existingEmail.subject = email.subject
            existingEmail.body = email.body
            existingEmail.snippet = email.snippet
            existingEmail.date = email.date
            existingEmail.labels = email.labels
            existingEmail.attachments = email.attachments.map(att => ({
              attachmentId: att.id,
              filename: att.filename,
              mimeType: att.mimeType,
              size: att.size
            }))
            existingEmail.isImportant = email.isImportant
            existingEmail.syncedAt = new Date()
            // Don't update isRead and isStarred - preserve local state
          } else {
            // Create new email
            db.create<EmailDocument>('Email', {
              id: email.id,
              threadId: email.threadId,
              from: `${email.from.name} <${email.from.email}>`,
              to: email.to.map(t => `${t.name} <${t.email}>`),
              subject: email.subject,
              body: email.body,
              snippet: email.snippet,
              date: email.date,
              labels: email.labels,
              attachments: email.attachments.map(att => ({
                attachmentId: att.id,
                filename: att.filename,
                mimeType: att.mimeType,
                size: att.size
              })),
              isRead: email.isRead,
              isStarred: email.isStarred,
              isImportant: email.isImportant,
              syncedAt: new Date()
            })
          }
        }
      })
      
      logInfo(`[EmailRepository] Successfully saved ${emails.length} emails`)
    } catch (error) {
      logError('[EmailRepository] Error saving emails:', error)
      throw error
    }
  }

  async getEmails(filter?: EmailFilter): Promise<Email[]> {
    try {
      const db = await getDatabase()
      if (!db) {
        logError('[EmailRepository] Database not available')
        return []
      }

      let query = db.objects<EmailDocument>('Email')
      
      // Apply filters
      if (filter?.isRead !== undefined) {
        query = query.filtered('isRead = $0', filter.isRead)
      }
      if (filter?.isStarred !== undefined) {
        query = query.filtered('isStarred = $0', filter.isStarred)
      }
      if (filter?.from) {
        query = query.filtered('from CONTAINS[c] $0', filter.from)
      }
      if (filter?.labels && filter.labels.length > 0) {
        for (const label of filter.labels) {
          query = query.filtered('labels CONTAINS $0', label)
        }
      }
      if (filter?.dateFrom) {
        query = query.filtered('date >= $0', filter.dateFrom)
      }
      if (filter?.dateTo) {
        query = query.filtered('date <= $0', filter.dateTo)
      }
      
      // Sort by date descending
      query = query.sorted('date', true)
      
      // Apply limit
      const limit = filter?.limit || 300
      const results = Array.from(query.slice(0, limit))
      
      // Convert to Email format
      return results.map(doc => this.documentToEmail(doc))
    } catch (error) {
      logError('[EmailRepository] Error getting emails:', error)
      return []
    }
  }

  async updateEmail(id: string, updates: Partial<Email>): Promise<void> {
    try {
      const db = await getDatabase()
      if (!db) {
        logError('[EmailRepository] Database not available')
        return
      }

      db.write(() => {
        const email = db.objectForPrimaryKey<EmailDocument>('Email', id)
        if (email) {
          if (updates.isRead !== undefined) email.isRead = updates.isRead
          if (updates.isStarred !== undefined) email.isStarred = updates.isStarred
          if (updates.isImportant !== undefined) email.isImportant = updates.isImportant
          if (updates.labels) email.labels = updates.labels
          
          logInfo(`[EmailRepository] Updated email ${id}`)
        } else {
          logError(`[EmailRepository] Email ${id} not found`)
        }
      })
    } catch (error) {
      logError(`[EmailRepository] Error updating email ${id}:`, error)
      throw error
    }
  }

  async deleteEmail(id: string): Promise<void> {
    try {
      const db = await getDatabase()
      if (!db) {
        logError('[EmailRepository] Database not available')
        return
      }

      db.write(() => {
        const email = db.objectForPrimaryKey<EmailDocument>('Email', id)
        if (email) {
          db.delete(email)
          logInfo(`[EmailRepository] Deleted email ${id}`)
        }
      })
    } catch (error) {
      logError(`[EmailRepository] Error deleting email ${id}:`, error)
      throw error
    }
  }

  async clearAll(): Promise<void> {
    try {
      const db = await getDatabase()
      if (!db) {
        logError('[EmailRepository] Database not available')
        return
      }

      db.write(() => {
        const allEmails = db.objects<EmailDocument>('Email')
        const count = allEmails.length
        db.delete(allEmails)
        logInfo(`[EmailRepository] Cleared ${count} emails`)
      })
    } catch (error) {
      logError('[EmailRepository] Error clearing emails:', error)
      throw error
    }
  }

  private documentToEmail(doc: EmailDocument): Email {
    // Parse from address
    const fromMatch = doc.from.match(/(.*?)\s*<(.+?)>/) || [null, doc.from, doc.from]
    const [, fromName, fromEmail] = fromMatch
    
    // Parse to addresses
    const to = Array.from(doc.to).map(addr => {
      const match = addr.match(/(.*?)\s*<(.+?)>/) || [null, addr, addr]
      const [, name, email] = match
      return { name: name?.trim() || email, email }
    })
    
    return {
      id: doc.id,
      threadId: doc.threadId,
      from: {
        name: fromName?.trim() || fromEmail,
        email: fromEmail
      },
      to,
      cc: undefined, // Not stored in current schema
      subject: doc.subject,
      snippet: doc.snippet,
      body: doc.body,
      date: doc.date,
      attachments: Array.from(doc.attachments).map((att: any) => ({
        id: att.attachmentId,
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size
      })),
      labels: Array.from(doc.labels),
      isRead: doc.isRead,
      isStarred: doc.isStarred,
      isImportant: doc.isImportant
    }
  }
}