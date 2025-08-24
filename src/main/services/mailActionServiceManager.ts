import {
  MailActionService,
  SendEmailResult,
  ScheduleEmailResult,
  LabelOperationResult,
  ListenInboxResult,
  AnalysisResult
} from '../../types/mailActions'
import { MockMailActionService } from './mockMailActionService'
import { logInfo } from '../../shared/logger'

export class MailActionServiceManager {
  private static instance: MailActionServiceManager
  private service: MailActionService

  private constructor() {
    // Initialize with mock service for now
    // In production, this would switch based on configuration
    this.service = new MockMailActionService()
    logInfo('[MailActionServiceManager] Initialized with MockMailActionService')
  }

  public static getInstance(): MailActionServiceManager {
    if (!MailActionServiceManager.instance) {
      MailActionServiceManager.instance = new MailActionServiceManager()
    }
    return MailActionServiceManager.instance
  }

  public getService(): MailActionService {
    return this.service
  }

  // Allow switching service implementation (useful for testing)
  public setService(service: MailActionService): void {
    this.service = service
    logInfo('[MailActionServiceManager] Service implementation changed')
  }

  // Expose service methods directly for convenience
  public async sendEmail(
    ...args: Parameters<MailActionService['sendEmail']>
  ): Promise<SendEmailResult> {
    return this.service.sendEmail(...args)
  }

  public async scheduleEmail(
    ...args: Parameters<MailActionService['scheduleEmail']>
  ): Promise<ScheduleEmailResult> {
    return this.service.scheduleEmail(...args)
  }

  public async addLabels(
    ...args: Parameters<MailActionService['addLabels']>
  ): Promise<LabelOperationResult> {
    return this.service.addLabels(...args)
  }

  public async removeLabels(
    ...args: Parameters<MailActionService['removeLabels']>
  ): Promise<LabelOperationResult> {
    return this.service.removeLabels(...args)
  }

  public async listenForEmails(
    ...args: Parameters<MailActionService['listenForEmails']>
  ): Promise<ListenInboxResult> {
    return this.service.listenForEmails(...args)
  }

  public async analysis(
    ...args: Parameters<MailActionService['analysis']>
  ): Promise<AnalysisResult> {
    return this.service.analysis(...args)
  }
}

// Export singleton instance getter for convenience
export const getMailActionService = (): MailActionServiceManager =>
  MailActionServiceManager.getInstance()
