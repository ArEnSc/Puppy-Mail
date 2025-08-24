import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as dotenv from 'dotenv'
import { GmailAuthService, setupAuthHandlers } from './auth/authService'
import { UnifiedEmailService } from './services/UnifiedEmailService'
import { createDatabase, closeDatabase } from './db/database'
import { logInfo, logError } from '../shared/logger'

import { setupLMStudioSDKHandlers } from './ipc/lmStudioSDKHandlers'

// Load environment variables
dotenv.config()

function createWindow(): void {
  logInfo('Creating main window')
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
  mainWindow.webContents.openDevTools()
  mainWindow.on('ready-to-show', () => {
    logInfo('Main window ready - showing window')
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    logInfo('Loading development URL:', process.env['ELECTRON_RENDERER_URL'])
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    logInfo('Loading production HTML file')
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  logInfo('App is ready - initializing')

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.chloe.email')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => logInfo('pong'))

  // Handle opening external links
  ipcMain.on('open-external', (_, url) => {
    shell.openExternal(url)
  })

  // Initialize database
  logInfo('Initializing database...')
  try {
    const db = await createDatabase()
    if (db) {
      logInfo('Database initialized successfully')
    } else {
      logError('Database initialization returned null - app will continue without database')
    }
  } catch (error) {
    logError('Failed to initialize database:', error)
    logError('Database initialization error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    // Continue anyway - the app can work without the database for now
  }

  // Initialize Gmail auth service
  const gmailAuthService = new GmailAuthService()
  setupAuthHandlers(gmailAuthService)

  // // Initialize workflow service
  // const workflowStorageDir = join(app.getPath('userData'), 'workflows')
  // const mailActionService = getMailActionService()
  // const workflowService = new WorkflowService(mailActionService, workflowStorageDir)

  // // Initialize workflow service
  // await workflowService.initialize()
  logInfo('WorkflowService initialized')

  // Initialize unified email service
  UnifiedEmailService.initialize(gmailAuthService)
  logInfo('Unified email service initialized')

  // Connect email service to workflow triggers
  // TODO: Implement proper email listener for workflow triggers
  /*
  UnifiedEmailService.getInstance()?.startPolling(5, undefined)
  
  // Old workflow trigger code - needs updating
  emailService.listenForEmails(undefined, async (emails) => {
    logInfo(`Processing ${emails.length} emails for workflow triggers`)

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

      logInfo(
        `Checking workflow triggers for email: ${email.subject} from ${emailMessage.from.email}`
      )

      try {
        // TODO FIX later for triggers
        //await workflowService.handleIncomingEmail(emailMessage)
      } catch (error) {
        logError('Error handling workflow trigger:', error)
      }
    }
  })
  */

  // Initialize LM Studio SDK handlers
  logInfo('Setting Up SDK Handlers LMStudio')
  setupLMStudioSDKHandlers()

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
            logInfo('Redirect detected:', url)

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
            logInfo('Navigation detected:', url)

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
      logError('Google OAuth error:', error)
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
    if (BrowserWindow.getAllWindows().length === 0) {
      logInfo('App activated - creating new window')
      createWindow()
    }
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    logInfo('All windows closed - quitting app')
    app.quit()
  } else {
    logInfo('All windows closed - app stays active (macOS)')
  }
})

// Clean up database on app quit
app.on('before-quit', async () => {
  logInfo('App is quitting - cleaning up database')
  await closeDatabase()
  logInfo('Database cleanup complete')
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
