import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as dotenv from 'dotenv'
import { GmailAuthService, setupAuthHandlers } from './auth/authService'
import { createEmailService } from './emailService'
import { createDatabase, closeDatabase } from './db/database'

// Load environment variables
dotenv.config()

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
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
  electronApp.setAppUserModelId('com.electron')

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
  await createDatabase()

  // Initialize Gmail auth service
  const gmailAuthService = new GmailAuthService()
  setupAuthHandlers(gmailAuthService)

  // Initialize email service
  createEmailService(gmailAuthService)

  // Handle the existing google-oauth-start event to bridge with new auth system
  ipcMain.on('google-oauth-start', async (event) => {
    try {
      await new Promise((resolve, reject) => {
        ipcMain.handleOnce('auth:start', async () => {
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

            authWindow.webContents.on('will-redirect', async (event, url) => {
              if (
                url.startsWith(
                  process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/auth/callback'
                )
              ) {
                event.preventDefault()

                const urlParams = new URL(url)
                const code = urlParams.searchParams.get('code')

                authWindow.close()

                if (code) {
                  await gmailAuthService.handleAuthCallback(code)
                  resolve({ success: true })
                } else {
                  reject(new Error('No authorization code received'))
                }
              }
            })

            authWindow.on('closed', () => {
              reject(new Error('Authentication cancelled'))
            })
          } catch (error) {
            reject(error)
          }
        })

        ipcMain.emit('auth:start')
      })
      // For now, we'll just indicate success since tokens are stored securely
      // In a real implementation, you'd fetch user info after auth
      event.reply('google-oauth-complete', {
        accessToken: 'stored-securely',
        refreshToken: 'stored-securely',
        expiresAt: new Date().getTime() + 3600000,
        userEmail: 'authenticated@gmail.com'
      })
    } catch (error) {
      event.reply('google-oauth-complete', {
        error: error instanceof Error ? error.message : 'Authentication failed'
      })
    }
  })

  createWindow()

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
