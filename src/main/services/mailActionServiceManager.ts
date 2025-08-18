import { MailActionService } from '../../types/mailActions'
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
  public async sendEmail(...args: Parameters<MailActionService['sendEmail']>) {
    return this.service.sendEmail(...args)
  }
  
  public async scheduleEmail(...args: Parameters<MailActionService['scheduleEmail']>) {
    return this.service.scheduleEmail(...args)
  }
  
  public async cancelScheduledEmail(...args: Parameters<MailActionService['cancelScheduledEmail']>) {
    return this.service.cancelScheduledEmail(...args)
  }
  
  public async getScheduledEmails(...args: Parameters<MailActionService['getScheduledEmails']>) {
    return this.service.getScheduledEmails(...args)
  }
  
  public async createDraft(...args: Parameters<MailActionService['createDraft']>) {
    return this.service.createDraft(...args)
  }
  
  public async updateDraft(...args: Parameters<MailActionService['updateDraft']>) {
    return this.service.updateDraft(...args)
  }
  
  public async deleteDraft(...args: Parameters<MailActionService['deleteDraft']>) {
    return this.service.deleteDraft(...args)
  }
  
  public async getDrafts(...args: Parameters<MailActionService['getDrafts']>) {
    return this.service.getDrafts(...args)
  }
  
  public async addLabels(...args: Parameters<MailActionService['addLabels']>) {
    return this.service.addLabels(...args)
  }
  
  public async removeLabels(...args: Parameters<MailActionService['removeLabels']>) {
    return this.service.removeLabels(...args)
  }
  
  public async setLabels(...args: Parameters<MailActionService['setLabels']>) {
    return this.service.setLabels(...args)
  }
  
  public async getLabels(...args: Parameters<MailActionService['getLabels']>) {
    return this.service.getLabels(...args)
  }
  
  public async createLabel(...args: Parameters<MailActionService['createLabel']>) {
    return this.service.createLabel(...args)
  }
  
  public async checkInbox(...args: Parameters<MailActionService['checkInbox']>) {
    return this.service.checkInbox(...args)
  }
  
  public async listenToInbox(...args: Parameters<MailActionService['listenToInbox']>) {
    return this.service.listenToInbox(...args)
  }
  
  public async stopListening(...args: Parameters<MailActionService['stopListening']>) {
    return this.service.stopListening(...args)
  }
  
  public async getThread(...args: Parameters<MailActionService['getThread']>) {
    return this.service.getThread(...args)
  }
  
  public async checkForResponse(...args: Parameters<MailActionService['checkForResponse']>) {
    return this.service.checkForResponse(...args)
  }
}

// Export singleton instance getter for convenience
export const getMailActionService = () => MailActionServiceManager.getInstance()