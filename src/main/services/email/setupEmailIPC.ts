import { ipcMain, BrowserWindow } from 'electron'
import { EmailService, Email } from './EmailService'
import { getCleanEmail } from '../../utils/emailSanitizer'
import { logInfo, logError } from '../../../shared/logger'

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

function transformEmailForStore(email: Email): StoreEmail {
  // Get clean version of the email
  const cleanEmail = getCleanEmail(email.body, email.attachments)
  
  return {
    id: email.id,
    threadId: email.threadId,
    subject: email.subject,
    from: email.from,
    to: email.to,
    cc: email.cc || [],
    date: email.date,
    snippet: email.snippet,
    body: email.body,
    cleanBody: cleanEmail.text,
    isRead: email.isRead,
    isStarred: email.isStarred,
    isImportant: email.isImportant,
    labels: email.labels,
    attachments: email.attachments,
    categorizedAttachments: cleanEmail.attachments
  }
}

export function setupEmailIPC(emailService: EmailService): void {
  let currentListenerId: string | null = null
  let lastSyncTime: Date | null = null

  // Fetch emails from database
  ipcMain.handle('email:fetch', async () => {
    try {
      logInfo('[IPC] Fetching emails from local database')
      const emails = await emailService.getLocalEmails({ limit: 300 })
      return emails.map(transformEmailForStore)
    } catch (error) {
      logError('[IPC] Error fetching emails:', error)
      return []
    }
  })

  // Sync emails from provider and save to database
  ipcMain.handle('email:sync', async () => {
    try {
      logInfo('[IPC] Syncing emails from provider')
      const result = await emailService.getEmails({ 
        filter: { limit: 300 },
        syncToDb: true 
      })
      
      if (result.success) {
        lastSyncTime = new Date()
        
        // Broadcast sync complete to all windows
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send('email:syncComplete', {
            timestamp: lastSyncTime,
            count: result.emails?.length || 0
          })
        })
        
        return { success: true, timestamp: lastSyncTime }
      } else {
        throw new Error(result.error || 'Failed to sync emails')
      }
    } catch (error) {
      logError('[IPC] Error syncing emails:', error)
      throw error
    }
  })

  // Start polling for new emails
  ipcMain.handle('email:startPolling', async (_, intervalMinutes?: number) => {
    try {
      // Stop any existing listener
      if (currentListenerId) {
        emailService.stopListening(currentListenerId)
      }
      
      // Start new listener
      const result = await emailService.listenForEmails(
        { limit: 300 },
        async (emails) => {
          logInfo(`[IPC] Received ${emails.length} new emails from listener`)
          
          // Get all emails from database after sync
          const allEmails = await emailService.getLocalEmails({ limit: 300 })
          const transformedEmails = allEmails.map(transformEmailForStore)
          
          // Broadcast to all windows
          BrowserWindow.getAllWindows().forEach((window) => {
            window.webContents.send('email:newEmails', transformedEmails)
          })
        }
      )
      
      if (result.success && result.listenerId) {
        currentListenerId = result.listenerId
        return { success: true, interval: intervalMinutes || 5 }
      } else {
        throw new Error(result.error || 'Failed to start polling')
      }
    } catch (error) {
      logError('[IPC] Error starting polling:', error)
      throw error
    }
  })

  // Stop polling
  ipcMain.handle('email:stopPolling', async () => {
    try {
      if (currentListenerId) {
        emailService.stopListening(currentListenerId)
        currentListenerId = null
      }
      return { success: true }
    } catch (error) {
      logError('[IPC] Error stopping polling:', error)
      throw error
    }
  })

  // Mark email as read
  ipcMain.handle('email:markAsRead', async (_, emailId: string) => {
    try {
      await emailService.updateLocalEmail(emailId, { isRead: true })
      return { success: true }
    } catch (error) {
      logError('[IPC] Error marking email as read:', error)
      throw error
    }
  })

  // Toggle star status
  ipcMain.handle('email:toggleStar', async (_, emailId: string) => {
    try {
      // Get current email to toggle star
      const emails = await emailService.getLocalEmails({ limit: 1 })
      const email = emails.find(e => e.id === emailId)
      
      if (email) {
        await emailService.updateLocalEmail(emailId, { isStarred: !email.isStarred })
      }
      
      return { success: true }
    } catch (error) {
      logError('[IPC] Error toggling star:', error)
      throw error
    }
  })

  // Clear all emails from database
  ipcMain.handle('email:clearAll', async () => {
    try {
      const repository = (emailService as any).repository
      if (repository && repository.clearAll) {
        await repository.clearAll()
      }
      return { success: true }
    } catch (error) {
      logError('[IPC] Error clearing all emails:', error)
      throw error
    }
  })

  // Send email
  ipcMain.handle('email:send', async (_, composition) => {
    try {
      const result = await emailService.sendEmail(composition)
      return result
    } catch (error) {
      logError('[IPC] Error sending email:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Analyze emails (for AI)
  ipcMain.handle('email:analyze', async (_, filter, prompt) => {
    try {
      const result = await emailService.analyzeEmails(filter, prompt)
      return result
    } catch (error) {
      logError('[IPC] Error analyzing emails:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })
}