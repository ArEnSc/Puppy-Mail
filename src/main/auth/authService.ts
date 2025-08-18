import { BrowserWindow, ipcMain, safeStorage } from 'electron'
import { google, gmail_v1 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'

interface AuthTokens {
  access_token?: string | null
  refresh_token?: string | null
  scope?: string
  token_type?: string | null
  expiry_date?: number | null
}

interface AuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export class GmailAuthService {
  private oauth2Client: OAuth2Client
  private tokenPath: string
  private config: AuthConfig

  constructor() {
    this.config = {
      clientId: process.env.GMAIL_CLIENT_ID || '',
      clientSecret: process.env.GMAIL_CLIENT_SECRET || '',
      redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/auth/callback'
    }

    this.oauth2Client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    )

    this.tokenPath = path.join(app.getPath('userData'), 'gmail-tokens.json')
  }

  private async saveTokens(tokens: AuthTokens): Promise<void> {
    try {
      const encrypted = safeStorage.encryptString(JSON.stringify(tokens))
      await fs.writeFile(this.tokenPath, encrypted)
    } catch (error) {
      console.error('Failed to save tokens:', error)
      throw new Error('Failed to save authentication tokens')
    }
  }

  private async loadTokens(): Promise<AuthTokens | null> {
    try {
      const encrypted = await fs.readFile(this.tokenPath)
      const decrypted = safeStorage.decryptString(encrypted)
      return JSON.parse(decrypted)
    } catch {
      return null
    }
  }

  async isAuthenticated(): Promise<boolean> {
    const tokens = await this.loadTokens()
    console.log(
      'Checking authentication, tokens exist:',
      !!tokens,
      'has refresh token:',
      !!tokens?.refresh_token
    )
    if (!tokens || !tokens.refresh_token) {
      return false
    }

    this.oauth2Client.setCredentials(tokens)

    try {
      await this.oauth2Client.getAccessToken()
      console.log('Successfully verified access token')
      return true
    } catch (error) {
      console.error('Failed to get access token:', error)
      return false
    }
  }

  async getAuthUrl(): Promise<string> {
    // Check if OAuth credentials are configured
    if (
      !this.config.clientId ||
      this.config.clientId === 'your_client_id_here' ||
      !this.config.clientId.includes('.apps.googleusercontent.com')
    ) {
      throw new Error(
        'Gmail OAuth is not configured. Please set GMAIL_CLIENT_ID in your .env file. You need to create a Google Cloud project and enable Gmail API.'
      )
    }

    if (!this.config.clientSecret || this.config.clientSecret === 'your_client_secret_here') {
      throw new Error(
        'Gmail OAuth is not configured. Please set GMAIL_CLIENT_SECRET in your .env file.'
      )
    }

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.readonly'],
      prompt: 'consent'
    })
  }

  async handleAuthCallback(code: string): Promise<void> {
    try {
      console.log('Exchanging auth code for tokens...')
      const { tokens } = await this.oauth2Client.getToken(code)
      console.log('Received tokens:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiryDate: tokens.expiry_date
      })
      await this.saveTokens(tokens)
      this.oauth2Client.setCredentials(tokens)
      console.log('Tokens saved and credentials set')
    } catch (error) {
      console.error('Auth callback error:', error)
      throw new Error('Failed to exchange authorization code')
    }
  }

  async getGmailClient(): Promise<gmail_v1.Gmail> {
    const tokens = await this.loadTokens()
    if (!tokens) {
      throw new Error('Not authenticated. Please authenticate first.')
    }

    this.oauth2Client.setCredentials(tokens)

    return google.gmail({ version: 'v1', auth: this.oauth2Client })
  }

  async refreshAccessToken(): Promise<void> {
    try {
      const tokens = await this.loadTokens()
      if (!tokens || !tokens.refresh_token) {
        throw new Error('No refresh token available')
      }

      this.oauth2Client.setCredentials(tokens)
      const { credentials } = await this.oauth2Client.refreshAccessToken()
      await this.saveTokens(credentials)
    } catch (error) {
      console.error('Failed to refresh token:', error)
      throw new Error('Failed to refresh access token')
    }
  }

  async logout(): Promise<void> {
    try {
      await fs.unlink(this.tokenPath)
      this.oauth2Client.setCredentials({})
    } catch (error) {
      console.error('Logout error:', error)
    }
  }
}

export function setupAuthHandlers(authService: GmailAuthService): void {
  ipcMain.handle('auth:check', async () => {
    return authService.isAuthenticated()
  })

  ipcMain.handle('auth:start', async () => {
    const authUrl = await authService.getAuthUrl()

    const authWindow = new BrowserWindow({
      width: 600,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    authWindow.loadURL(authUrl)

    return new Promise((resolve, reject) => {
      authWindow.webContents.on('will-redirect', async (event, url) => {
        if (url.startsWith(authService['config'].redirectUri)) {
          event.preventDefault()

          const urlParams = new URL(url)
          const code = urlParams.searchParams.get('code')
          const error = urlParams.searchParams.get('error')

          authWindow.close()

          if (error) {
            reject(new Error(`Authentication failed: ${error}`))
            return
          }

          if (code) {
            try {
              await authService.handleAuthCallback(code)
              resolve({ success: true })
            } catch (error) {
              reject(error)
            }
          }
        }
      })

      authWindow.on('closed', () => {
        reject(new Error('Authentication cancelled'))
      })
    })
  })

  ipcMain.handle('auth:logout', async () => {
    await authService.logout()
  })
}
