import * as cron from 'node-cron'
import { getEmailConfig, getPollInterval } from './config'
import { pollEmails, formatEmail, FormattedEmail } from './emailManager'

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

  return service
}
