import * as cron from 'node-cron'
import { ipcMain, BrowserWindow } from 'electron'
import { getEmailConfig, getPollInterval } from './config'
import { formatEmail, FormattedEmail, Email, pollEmailsWithClient } from './emailManager'
import { getCleanEmail } from './utils/emailSanitizer'
import { EmailService as DBEmailService } from './db/emailService'
import { GmailAuthService } from './auth/authService'

export class EmailService {
  private cronJob: cron.ScheduledTask | null = null
  private emailHandler: ((emails: FormattedEmail[]) => void) | null = null
  private gmailAuthService: GmailAuthService
  lastSyncTime: Date | null = null

  constructor(gmailAuthService: GmailAuthService) {
    this.gmailAuthService = gmailAuthService
  }

  onNewEmails(handler: (emails: FormattedEmail[]) => void): void {
    this.emailHandler = handler
  }

  async fetchLatestEmails(maxResults: number = 10): Promise<FormattedEmail[]> {
    try {
      console.log(`fetchLatestEmails called with maxResults: ${maxResults}`)

      // Check if authenticated
      const isAuth = await this.gmailAuthService.isAuthenticated()
      console.log('Authentication check result:', isAuth)

      if (!isAuth) {
        throw new Error('Not authenticated with Gmail')
      }

      // Get authenticated Gmail client
      const gmail = await this.gmailAuthService.getGmailClient()
      console.log('Gmail client obtained successfully')

      // Get whitelisted emails from config if available
      let whitelistedEmails: string[] = []
      try {
        const config = getEmailConfig()
        whitelistedEmails = config.whitelistedEmails || []
      } catch {
        // Config might not be available if using OAuth, that's ok
      }

      console.log(`Calling pollEmailsWithClient with whitelisted emails: ${whitelistedEmails}`)
      const emails = await pollEmailsWithClient(gmail, maxResults, whitelistedEmails)
      console.log(`pollEmailsWithClient returned ${emails.length} emails`)

      // Save to database - RxDB will handle duplicates via primary key
      if (emails.length > 0) {
        console.log('Saving emails to database...')
        try {
          await DBEmailService.syncEmails('default', emails)
          console.log('Emails saved to database successfully')
        } catch (dbError) {
          console.error('Failed to save emails to database:', dbError)
          // Continue anyway - the emails are still fetched
        }
        this.lastSyncTime = new Date()

        // Notify renderer about sync completion
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send('email:syncComplete', {
            timestamp: this.lastSyncTime,
            count: emails.length
          })
        })
        console.log('Sync complete notification sent')
      } else {
        console.log('No emails returned from poll')
      }

      return emails.map(formatEmail)
    } catch (error) {
      console.error('Error fetching emails:', error)
      throw error
    }
  }

  startPolling(): void {
    const interval = getPollInterval()
    const cronExpression = `*/${interval} * * * *` // Every N minutes

    console.log(`Starting email polling every ${interval} minutes`)

    this.cronJob = cron.schedule(cronExpression, async () => {
      try {
        const emails = await this.fetchLatestEmails()
        if (this.emailHandler && emails.length > 0) {
          this.emailHandler(emails)
        }
      } catch (error) {
        console.error('Error during scheduled email poll:', error)
      }
    })

    // Also fetch immediately on start
    this.fetchLatestEmails()
      .then((emails) => {
        if (this.emailHandler && emails.length > 0) {
          this.emailHandler(emails)
        }
      })
      .catch(console.error)
  }

  stopPolling(): void {
    if (this.cronJob) {
      this.cronJob.stop()
      this.cronJob = null
      console.log('Email polling stopped')
    }
  }
}

// Transform email to match Zustand store format
interface StoreEmail {
  id: string
  threadId: string
  subject: string
  from: {
    name: string
    email: string
  }
  to: Array<{
    name: string
    email: string
  }>
  cc: Array<{
    name: string
    email: string
  }>
  date: Date
  snippet: string
  body: string
  cleanBody: string
  isRead: boolean
  isStarred: boolean
  isImportant: boolean
  labels: string[]
  attachments: Array<{
    id: string
    filename: string
    mimeType: string
    size: number
  }>
  categorizedAttachments: {
    images: Array<{ id: string; filename: string; mimeType: string; size: number }>
    pdfs: Array<{ id: string; filename: string; mimeType: string; size: number }>
    videos: Array<{ id: string; filename: string; mimeType: string; size: number }>
    others: Array<{ id: string; filename: string; mimeType: string; size: number }>
  }
}

function transformEmailForStore(
  email: Email & { isRead?: boolean; isStarred?: boolean; labels?: string[] }
): StoreEmail {
  const senderMatch = email.from.match(/(.*?)\s*<(.+?)>/) || [null, email.from, email.from]
  const [, senderName, senderEmail] = senderMatch

  // Get clean version of the email
  const attachmentsWithId = email.attachments.map((att) => ({
    id: att.attachmentId,
    filename: att.filename,
    mimeType: att.mimeType,
    size: att.size
  }))
  const cleanEmail = getCleanEmail(email.body, attachmentsWithId)

  return {
    id: email.id,
    threadId: email.threadId,
    subject: email.subject,
    from: {
      name: senderName?.trim() || senderEmail,
      email: senderEmail
    },
    to: [
      {
        name: email.to,
        email: email.to
      }
    ],
    cc: [],
    date: email.date,
    snippet: email.snippet,
    body: email.body,
    cleanBody: cleanEmail.text,
    isRead: email.isRead ?? false,
    isStarred: email.isStarred ?? false,
    isImportant: false,
    labels: email.labels || ['inbox'],
    attachments: email.attachments.map((att) => ({
      id: att.attachmentId,
      filename: att.filename,
      mimeType: att.mimeType,
      size: att.size
    })),
    categorizedAttachments: cleanEmail.attachments
  }
}

// Set up IPC handlers for email operations
export function setupEmailIPC(service: EmailService): void {
  // Fetch emails from database
  ipcMain.handle('email:fetch', async () => {
    try {
      const dbEmails = await DBEmailService.getEmails(50, 0)
      return dbEmails.map((doc) =>
        transformEmailForStore({
          id: doc.id,
          threadId: doc.threadId,
          from: doc.from,
          to: doc.to.join(', '),
          subject: doc.subject,
          snippet: doc.snippet,
          body: doc.body,
          date: new Date(doc.date),
          attachments: doc.attachments,
          internalDate: new Date(doc.date).getTime().toString(),
          labels: doc.labels,
          isRead: doc.isRead,
          isStarred: doc.isStarred
        })
      )
    } catch (error) {
      console.error('Error fetching emails from database:', error)
      // Return empty array instead of throwing to keep the app functional
      return []
    }
  })

  // Sync emails from Gmail and save to database
  ipcMain.handle('email:sync', async () => {
    try {
      console.log('Email sync requested')
      const emails = await service.fetchLatestEmails(50)
      console.log(`Sync completed: fetched ${emails.length} emails`)
      return { success: true, timestamp: service.lastSyncTime }
    } catch (error) {
      console.error('Error syncing emails:', error)
      throw error
    }
  })

  // Start polling
  ipcMain.handle('email:startPolling', async (_, intervalMinutes?: number) => {
    const interval = intervalMinutes || getPollInterval()
    service.stopPolling() // Stop any existing polling

    // Set up handler to broadcast new emails
    service.onNewEmails(async () => {
      // Instead of re-fetching, get emails from database after sync
      try {
        const dbEmails = await DBEmailService.getEmails(50, 0)
        const transformedEmails = dbEmails.map((doc) =>
          transformEmailForStore({
            id: doc.id,
            threadId: doc.threadId,
            from: doc.from,
            to: doc.to.join(', '),
            subject: doc.subject,
            snippet: doc.snippet,
            body: doc.body,
            date: new Date(doc.date),
            attachments: doc.attachments,
            internalDate: doc.date.getTime().toString(),
            labels: doc.labels,
            isRead: doc.isRead,
            isStarred: doc.isStarred
          })
        )
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send('email:newEmails', transformedEmails)
        })
      } catch (error) {
        console.error('Error broadcasting new emails:', error)
      }
    })

    service.startPolling()
    return { success: true, interval }
  })

  // Stop polling
  ipcMain.handle('email:stopPolling', async () => {
    service.stopPolling()
    return { success: true }
  })

  // Mark email as read
  ipcMain.handle('email:markAsRead', async (_, emailId: string) => {
    try {
      await DBEmailService.markAsRead(emailId)
      return { success: true }
    } catch (error) {
      console.error('Error marking email as read:', error)
      throw error
    }
  })

  // Toggle star status
  ipcMain.handle('email:toggleStar', async (_, emailId: string) => {
    try {
      await DBEmailService.toggleStar(emailId)
      return { success: true }
    } catch (error) {
      console.error('Error toggling star:', error)
      throw error
    }
  })
}

// Example usage
export function createEmailService(gmailAuthService: GmailAuthService): EmailService {
  const service = new EmailService(gmailAuthService)

  // Set up handler for new emails
  service.onNewEmails((emails) => {
    console.log(`Received ${emails.length} new emails:`)
    emails.forEach((email) => {
      console.log(`- From: ${email.sender}`)
      console.log(`  Subject: ${email.subject}`)
      console.log(`  Preview: ${email.preview}`)
      console.log(`  Has Attachments: ${email.hasAttachments}`)
      console.log('---')
    })
  })

  // Set up IPC handlers
  setupEmailIPC(service)

  return service
}
