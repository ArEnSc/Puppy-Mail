import { ipcMain } from 'electron'
import { getMailActionService } from '../services/mailActionServiceManager'
import { logInfo } from '../../shared/logger'
import {
  EmailComposition,
  ScheduledEmail,
  LabelOperation,
  InboxListener
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

  // Label operations
  ipcMain.handle('mailAction:addLabels', async (_event, operation: LabelOperation) => {
    return mailService.addLabels(operation)
  })

  ipcMain.handle('mailAction:removeLabels', async (_event, operation: LabelOperation) => {
    return mailService.removeLabels(operation)
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

  logInfo('[MailActionHandlers] IPC handlers registered')
}
