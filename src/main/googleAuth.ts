import { BrowserWindow, ipcMain } from 'electron'
import { google } from 'googleapis'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3000/oauth/callback' // Redirect URI
)

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify'
]

export function setupGoogleAuth(mainWindow: BrowserWindow) {
  ipcMain.on('google-oauth-start', async (event) => {
    try {
      // Generate the auth URL
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
      })
      
      // Create a new window for authentication
      const authWindow = new BrowserWindow({
        width: 600,
        height: 800,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })
      
      authWindow.loadURL(authUrl)
      
      // Handle the OAuth callback
      authWindow.webContents.on('will-redirect', async (event, url) => {
        if (url.startsWith('http://localhost:3000/oauth/callback')) {
          event.preventDefault()
          
          const urlParams = new URL(url)
          const code = urlParams.searchParams.get('code')
          
          if (code) {
            try {
              const { tokens } = await oauth2Client.getToken(code)
              oauth2Client.setCredentials(tokens)
              
              // Get user info
              const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
              const { data } = await oauth2.userinfo.get()
              
              mainWindow.webContents.send('google-oauth-complete', {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresAt: tokens.expiry_date,
                userEmail: data.email
              })
              
              authWindow.close()
            } catch (error) {
              mainWindow.webContents.send('google-oauth-complete', {
                error: 'Failed to exchange authorization code'
              })
              authWindow.close()
            }
          }
        }
      })
      
      authWindow.on('closed', () => {
        // If window is closed without completing auth
        mainWindow.webContents.send('google-oauth-complete', {
          error: 'Authentication cancelled'
        })
      })
    } catch (error) {
      event.reply('google-oauth-complete', {
        error: 'Failed to start authentication'
      })
    }
  })
}