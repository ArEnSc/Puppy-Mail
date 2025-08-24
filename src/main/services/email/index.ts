import { EmailService } from './emailService'
import { GmailService } from '../gmail/gmailService'
import { EmailRepository } from './emailRepository'
import { GmailAuthService } from '../../auth/authService'
import { setupEmailIPC } from './setupEmailIPC'
import { logInfo } from '../../../shared/logger'

let emailServiceInstance: EmailService | null = null

export function createEmailService(gmailAuthService: GmailAuthService): EmailService {
  if (emailServiceInstance) {
    return emailServiceInstance
  }

  logInfo('[EmailService] Creating new email service instance')
  
  // Create provider and repository
  const gmailProvider = new GmailService(gmailAuthService)
  const emailRepository = new EmailRepository()
  
  // Create main service
  emailServiceInstance = new EmailService(gmailProvider, emailRepository)
  
  // Set up IPC handlers
  setupEmailIPC(emailServiceInstance)
  
  logInfo('[EmailService] Email service initialized successfully')
  
  return emailServiceInstance
}

export function getEmailService(): EmailService | null {
  return emailServiceInstance
}

export { EmailService, type Email, type EmailComposition, type EmailFilter } from './emailService'