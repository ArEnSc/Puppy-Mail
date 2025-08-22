import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as dotenv from 'dotenv'
import { GmailAuthService, setupAuthHandlers } from './auth/authService'
import { createEmailService } from './services/email/emailService'
import { createDatabase, closeDatabase } from './db/database'
import { LMStudioService, setupLMStudioHandlers } from './lmStudioService'
import { setupLMStudioSDKHandlers } from './ipc/lmStudioSDKHandlers'
import { setupMailActionHandlers } from './ipc/mailActionHandlers'
import { WorkflowService } from '../workflow/WorkflowService'
import { getMailActionService } from './services/mailActionServiceManager'
import { sanitizeEmailBody } from './utils/emailSanitizer'

// Load environment variables
dotenv.config()

// Helper functions for email parsing
function extractEmailAddress(emailString: string): string {
  // Extract email from strings like "John Doe <john@example.com>"
  const match = emailString.match(/<(.+)>/)
  return match ? match[1] : emailString
}

function extractName(emailString: string): string | undefined {
  // Extract name from strings like "John Doe <john@example.com>"
  const match = emailString.match(/^([^<]+)\s*</)
  return match ? match[1].trim() : undefined
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    title: 'Chloe - Email Companion',
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.chloe.email')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Handle opening external links
  ipcMain.on('open-external', (_, url) => {
    shell.openExternal(url)
  })

  // Initialize database
  console.log('Initializing database...')
  try {
    const db = await createDatabase()
    if (db) {
      console.log('Database initialized successfully')
    } else {
      console.error('Database initialization returned null - app will continue without database')
    }
  } catch (error) {
    console.error('Failed to initialize database:', error)
    console.error('Database initialization error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    // Continue anyway - the app can work without the database for now
  }

  // Initialize Gmail auth service
  const gmailAuthService = new GmailAuthService()
  setupAuthHandlers(gmailAuthService)

  // Initialize workflow service
  const workflowStorageDir = join(app.getPath('userData'), 'workflows')
  const mailActionService = getMailActionService()
  const workflowService = new WorkflowService(mailActionService, workflowStorageDir)

  // Initialize workflow service
  await workflowService.initialize()
  console.log('WorkflowService initialized')

  // Initialize email service
  const emailService = createEmailService(gmailAuthService)

  // Connect email service to workflow triggers
  emailService.onRawEmails(async (emails) => {
    console.log(`Processing ${emails.length} emails for workflow triggers`)

    for (const email of emails) {
      // Convert Email to EmailMessage format for workflows
      // Gmail provides "Name <email@example.com>" format, we need to parse it
      const emailMessage = {
        id: email.id,
        from: {
          email: extractEmailAddress(email.from),
          name: extractName(email.from)
        },
        to: [
          {
            email: extractEmailAddress(email.to),
            name: extractName(email.to)
          }
        ],
        subject: email.subject,
        body: sanitizeEmailBody(email.body), // Clean up HTML and formatting
        date: email.date,
        labels: email.labels,
        isRead: email.isRead,
        hasAttachment: email.attachments.length > 0,
        threadId: email.threadId
      }

      console.log(
        `Checking workflow triggers for email: ${email.subject} from ${emailMessage.from.email}`
      )

      try {
        await workflowService.handleIncomingEmail(emailMessage)
      } catch (error) {
        console.error('Error handling workflow trigger:', error)
      }
    }
  })

  // Initialize LM Studio SDK handlers
  setupLMStudioSDKHandlers()

  // Initialize LM Studio service (keeping for backward compatibility)
  const lmStudioService = new LMStudioService()
  setupLMStudioHandlers(lmStudioService)

  // Initialize Mail Action handlers
  setupMailActionHandlers()

  // Handle the existing google-oauth-start event to bridge with new auth system
  ipcMain.on('google-oauth-start', async (event) => {
    try {
      const authUrl = await gmailAuthService.getAuthUrl()

      const authWindow = new BrowserWindow({
        width: 600,
        height: 800,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      authWindow.loadURL(authUrl)

      let authCompleted = false

      // Add a timeout to prevent hanging
      const authTimeout = setTimeout(() => {
        if (!authCompleted) {
          authWindow.close()
        }
      }, 120000) // 2 minute timeout

      const result = await new Promise<{ success: boolean; userEmail?: string }>(
        (resolve, reject) => {
          // Handle redirects
          authWindow.webContents.on('will-redirect', async (navEvent, url) => {
            console.log('Redirect detected:', url)

            // Check if this is our callback URL with a code parameter
            const redirectUri =
              process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/auth/callback'
            if (url.startsWith(redirectUri) && url.includes('code=')) {
              navEvent.preventDefault()
              authCompleted = true

              const urlParams = new URL(url)
              const code = urlParams.searchParams.get('code')

              if (code) {
                try {
                  await gmailAuthService.handleAuthCallback(code)

                  // Get user info after successful auth
                  const gmail = await gmailAuthService.getGmailClient()
                  const profile = await gmail.users.getProfile({ userId: 'me' })

                  authWindow.close()
                  clearTimeout(authTimeout)
                  resolve({
                    success: true,
                    userEmail: profile.data.emailAddress || 'authenticated@gmail.com'
                  })
                } catch (authError) {
                  authWindow.close()
                  reject(authError)
                }
              } else {
                authWindow.close()
                reject(new Error('No authorization code received'))
              }
            }
            // Don't do anything for other redirects - let the OAuth flow continue
          })

          // Also handle navigation for apps that don't trigger will-redirect
          authWindow.webContents.on('will-navigate', (navEvent, url) => {
            console.log('Navigation detected:', url)

            // Check if this is our callback URL with a code parameter
            const redirectUri =
              process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/auth/callback'
            if (url.startsWith(redirectUri) && url.includes('code=')) {
              navEvent.preventDefault()
              authCompleted = true

              const urlParams = new URL(url)
              const code = urlParams.searchParams.get('code')

              if (code) {
                gmailAuthService
                  .handleAuthCallback(code)
                  .then(async () => {
                    const gmail = await gmailAuthService.getGmailClient()
                    const profile = await gmail.users.getProfile({ userId: 'me' })
                    authWindow.close()
                    clearTimeout(authTimeout)
                    resolve({
                      success: true,
                      userEmail: profile.data.emailAddress || 'authenticated@gmail.com'
                    })
                  })
                  .catch((authError) => {
                    authWindow.close()
                    reject(authError)
                  })
              } else {
                authWindow.close()
                reject(new Error('No authorization code received'))
              }
            }
            // Don't do anything for other navigations - let the OAuth flow continue
          })

          authWindow.on('closed', () => {
            if (!authCompleted) {
              reject(new Error('Authentication cancelled'))
            }
          })
        }
      )

      // Send success response
      event.reply('google-oauth-complete', {
        accessToken: 'stored-securely',
        refreshToken: 'stored-securely',
        expiresAt: new Date().getTime() + 3600000,
        userEmail: result.userEmail,
        isAuthenticated: true
      })
    } catch (error) {
      console.error('Google OAuth error:', error)
      event.reply('google-oauth-complete', {
        error: error instanceof Error ? error.message : 'Authentication failed'
      })
    }
  })

  createWindow()

  // Set dock icon for macOS in development
  if (process.platform === 'darwin' && is.dev && app.dock) {
    app.dock.setIcon(icon)
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up database on app quit
app.on('before-quit', async () => {
  await closeDatabase()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
