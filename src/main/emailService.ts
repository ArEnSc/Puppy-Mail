import * as cron from 'node-cron'
import { ipcMain, BrowserWindow } from 'electron'
import { getEmailConfig, getPollInterval } from './config'
import { pollEmails, formatEmail, FormattedEmail, Email } from './emailManager'
import { getCleanEmail } from './utils/emailSanitizer'

export class EmailService {
  private cronJob: cron.ScheduledTask | null = null
  private emailHandler: ((emails: FormattedEmail[]) => void) | null = null

  onNewEmails(handler: (emails: FormattedEmail[]) => void): void {
    this.emailHandler = handler
  }

  async fetchLatestEmails(maxResults: number = 10): Promise<FormattedEmail[]> {
    try {
      const config = getEmailConfig()
      const emails = await pollEmails(config, maxResults)
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
function transformEmailForStore(email: Email): any {
  const senderMatch = email.from.match(/(.*?)\s*<(.+?)>/) || [null, email.from, email.from]
  const [, senderName, senderEmail] = senderMatch
  
  // Get clean version of the email
  const attachmentsWithId = email.attachments.map(att => ({
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
    to: [{
      name: email.to,
      email: email.to
    }],
    cc: [],
    date: email.date,
    snippet: email.snippet,
    body: email.body,
    cleanBody: cleanEmail.text,
    isRead: false,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
    attachments: email.attachments.map(att => ({
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
  // Fetch emails on demand
  ipcMain.handle('email:fetch', async () => {
    try {
      const config = getEmailConfig()
      const emails = await pollEmails(config, 50)
      return emails.map(transformEmailForStore)
    } catch (error) {
      console.error('Error fetching emails:', error)
      throw error
    }
  })

  // Start polling
  ipcMain.handle('email:startPolling', async (_, intervalMinutes?: number) => {
    const interval = intervalMinutes || getPollInterval()
    service.stopPolling() // Stop any existing polling
    
    // Set up handler to broadcast new emails
    service.onNewEmails(() => {
      // Fetch full emails and transform them
      pollEmails(getEmailConfig(), 50).then(emails => {
        const transformedEmails = emails.map(transformEmailForStore)
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.send('email:newEmails', transformedEmails)
        })
      }).catch(console.error)
    })
    
    service.startPolling()
    return { success: true, interval }
  })

  // Stop polling
  ipcMain.handle('email:stopPolling', async () => {
    service.stopPolling()
    return { success: true }
  })
}

// Example usage
export function createEmailService(): EmailService {
  const service = new EmailService()

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
