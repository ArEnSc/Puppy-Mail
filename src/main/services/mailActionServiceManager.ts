import {
  MailActionService,
  SendEmailResult,
  ScheduleEmailResult,
  CancelScheduledResult,
  GetScheduledEmailsResult,
  CreateDraftResult,
  UpdateDraftResult,
  DeleteDraftResult,
  GetDraftsResult,
  LabelOperationResult,
  GetLabelsResult,
  CreateLabelResult,
  ReadEmailResult,
  ReadEmailsResult,
  MarkReadResult,
  SearchEmailsResult,
  CheckInboxResult,
  ListenInboxResult,
  StopListeningResult,
  GetThreadResult,
  CheckResponseResult
} from '../../types/mailActions'
import { MockMailActionService } from './mockMailActionService'

export class MailActionServiceManager {
  private static instance: MailActionServiceManager
  private service: MailActionService

  private constructor() {
    // Initialize with mock service for now
    // In production, this would switch based on configuration
    this.service = new MockMailActionService()
    console.log('[MailActionServiceManager] Initialized with MockMailActionService')
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
    console.log('[MailActionServiceManager] Service implementation changed')
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

  public async cancelScheduledEmail(
    ...args: Parameters<MailActionService['cancelScheduledEmail']>
  ): Promise<CancelScheduledResult> {
    return this.service.cancelScheduledEmail(...args)
  }

  public async getScheduledEmails(
    ...args: Parameters<MailActionService['getScheduledEmails']>
  ): Promise<GetScheduledEmailsResult> {
    return this.service.getScheduledEmails(...args)
  }

  public async createDraft(
    ...args: Parameters<MailActionService['createDraft']>
  ): Promise<CreateDraftResult> {
    return this.service.createDraft(...args)
  }

  public async updateDraft(
    ...args: Parameters<MailActionService['updateDraft']>
  ): Promise<UpdateDraftResult> {
    return this.service.updateDraft(...args)
  }

  public async deleteDraft(
    ...args: Parameters<MailActionService['deleteDraft']>
  ): Promise<DeleteDraftResult> {
    return this.service.deleteDraft(...args)
  }

  public async getDrafts(
    ...args: Parameters<MailActionService['getDrafts']>
  ): Promise<GetDraftsResult> {
    return this.service.getDrafts(...args)
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

  public async setLabels(
    ...args: Parameters<MailActionService['setLabels']>
  ): Promise<LabelOperationResult> {
    return this.service.setLabels(...args)
  }

  public async getLabels(
    ...args: Parameters<MailActionService['getLabels']>
  ): Promise<GetLabelsResult> {
    return this.service.getLabels(...args)
  }

  public async createLabel(
    ...args: Parameters<MailActionService['createLabel']>
  ): Promise<CreateLabelResult> {
    return this.service.createLabel(...args)
  }

  public async readEmail(
    ...args: Parameters<MailActionService['readEmail']>
  ): Promise<ReadEmailResult> {
    return this.service.readEmail(...args)
  }

  public async readEmails(
    ...args: Parameters<MailActionService['readEmails']>
  ): Promise<ReadEmailsResult> {
    return this.service.readEmails(...args)
  }

  public async markAsRead(
    ...args: Parameters<MailActionService['markAsRead']>
  ): Promise<MarkReadResult> {
    return this.service.markAsRead(...args)
  }

  public async markAsUnread(
    ...args: Parameters<MailActionService['markAsUnread']>
  ): Promise<MarkReadResult> {
    return this.service.markAsUnread(...args)
  }

  public async searchEmails(
    ...args: Parameters<MailActionService['searchEmails']>
  ): Promise<SearchEmailsResult> {
    return this.service.searchEmails(...args)
  }

  public async checkInbox(
    ...args: Parameters<MailActionService['checkInbox']>
  ): Promise<CheckInboxResult> {
    return this.service.checkInbox(...args)
  }

  public async listenToInbox(
    ...args: Parameters<MailActionService['listenToInbox']>
  ): Promise<ListenInboxResult> {
    return this.service.listenToInbox(...args)
  }

  public async stopListening(
    ...args: Parameters<MailActionService['stopListening']>
  ): Promise<StopListeningResult> {
    return this.service.stopListening(...args)
  }

  public async getThread(
    ...args: Parameters<MailActionService['getThread']>
  ): Promise<GetThreadResult> {
    return this.service.getThread(...args)
  }

  public async checkForResponse(
    ...args: Parameters<MailActionService['checkForResponse']>
  ): Promise<CheckResponseResult> {
    return this.service.checkForResponse(...args)
  }
}

// Export singleton instance getter for convenience
export const getMailActionService = (): MailActionServiceManager =>
  MailActionServiceManager.getInstance()
