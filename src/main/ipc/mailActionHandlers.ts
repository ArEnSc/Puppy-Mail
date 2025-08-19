import { ipcMain } from 'electron'
import { getMailActionService } from '../services/mailActionServiceManager'
import {
  EmailComposition,
  ScheduledEmail,
  LabelOperation,
  InboxListener,
  EmailLabel
} from '../../types/mailActions'

export function setupMailActionHandlers(): void {
  const mailService = getMailActionService()

  // Send operations
  ipcMain.handle('mailAction:sendEmail', async (_event, composition: EmailComposition) => {
    return mailService.sendEmail(composition)
  })

  ipcMain.handle('mailAction:scheduleEmail', async (_event, scheduledEmail: ScheduledEmail) => {
    return mailService.scheduleEmail(scheduledEmail)
  })

  ipcMain.handle('mailAction:cancelScheduledEmail', async (_event, scheduledId: string) => {
    return mailService.cancelScheduledEmail(scheduledId)
  })

  ipcMain.handle('mailAction:getScheduledEmails', async () => {
    return mailService.getScheduledEmails()
  })

  // Compose operations
  ipcMain.handle('mailAction:createDraft', async (_event, composition: EmailComposition) => {
    return mailService.createDraft(composition)
  })

  ipcMain.handle(
    'mailAction:updateDraft',
    async (_event, draftId: string, composition: Partial<EmailComposition>) => {
      return mailService.updateDraft(draftId, composition)
    }
  )

  ipcMain.handle('mailAction:deleteDraft', async (_event, draftId: string) => {
    return mailService.deleteDraft(draftId)
  })

  ipcMain.handle('mailAction:getDrafts', async () => {
    return mailService.getDrafts()
  })

  // Label operations
  ipcMain.handle('mailAction:addLabels', async (_event, operation: LabelOperation) => {
    return mailService.addLabels(operation)
  })

  ipcMain.handle('mailAction:removeLabels', async (_event, operation: LabelOperation) => {
    return mailService.removeLabels(operation)
  })

  ipcMain.handle('mailAction:setLabels', async (_event, operation: LabelOperation) => {
    return mailService.setLabels(operation)
  })

  ipcMain.handle('mailAction:getLabels', async () => {
    return mailService.getLabels()
  })

  ipcMain.handle('mailAction:createLabel', async (_event, label: Omit<EmailLabel, 'id'>) => {
    return mailService.createLabel(label)
  })

  // Read operations
  ipcMain.handle('mailAction:readEmail', async (_event, emailId: string) => {
    return mailService.readEmail(emailId)
  })

  ipcMain.handle('mailAction:readEmails', async (_event, emailIds: string[]) => {
    return mailService.readEmails(emailIds)
  })

  ipcMain.handle('mailAction:markAsRead', async (_event, emailId: string) => {
    return mailService.markAsRead(emailId)
  })

  ipcMain.handle('mailAction:markAsUnread', async (_event, emailId: string) => {
    return mailService.markAsUnread(emailId)
  })

  ipcMain.handle('mailAction:searchEmails', async (_event, query: string, limit?: number) => {
    return mailService.searchEmails(query, limit)
  })

  // Inbox operations
  ipcMain.handle('mailAction:checkInbox', async (_event, filter?: InboxListener['filter']) => {
    return mailService.checkInbox(filter)
  })

  // Inbox listener requires special handling for callbacks
  const activeListeners = new Map<string, { webContentsId: number }>()

  ipcMain.handle('mailAction:listenToInbox', async (event, filter?: InboxListener['filter']) => {
    const webContentsId = event.sender.id

    const result = await mailService.listenToInbox({
      filter,
      callback: (email) => {
        // Send the email back to the renderer process
        if (!event.sender.isDestroyed()) {
          event.sender.send('mailAction:inboxUpdate', email)
        }
      }
    })

    if (result.success && result.data) {
      activeListeners.set(result.data.listenerId, { webContentsId })
    }

    return result
  })

  ipcMain.handle('mailAction:stopListening', async (_event, listenerId: string) => {
    activeListeners.delete(listenerId)
    return mailService.stopListening(listenerId)
  })

  // Thread operations
  ipcMain.handle('mailAction:getThread', async (_event, threadId: string) => {
    return mailService.getThread(threadId)
  })

  ipcMain.handle('mailAction:checkForResponse', async (_event, originalMessageId: string) => {
    return mailService.checkForResponse(originalMessageId)
  })

  console.log('[MailActionHandlers] IPC handlers registered')
}
