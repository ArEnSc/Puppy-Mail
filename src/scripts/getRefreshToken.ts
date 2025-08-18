import { google } from 'googleapis'
import * as http from 'http'
import * as url from 'url'
import open from 'open'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.join(__dirname, '../../.env') })

const PORT = 3000
const REDIRECT_PATH = '/auth/callback'

interface AuthResult {
  refreshToken: string | null | undefined
  accessToken: string | null | undefined
  expiryDate: number | null | undefined
}

async function getRefreshToken(): Promise<AuthResult> {
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET in .env file')
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    `http://localhost:${PORT}${REDIRECT_PATH}`
  )

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    prompt: 'consent'
  })

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = url.parse(req.url || '', true)

        if (reqUrl.pathname === REDIRECT_PATH) {
          const code = reqUrl.query.code as string
          const error = reqUrl.query.error as string

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' })
            res.end(`
              <h1>Authentication Failed</h1>
              <p>Error: ${error}</p>
              <p>You can close this window.</p>
            `)
            server.close()
            reject(new Error(`Authentication failed: ${error}`))
            return
          }

          if (code) {
            try {
              const { tokens } = await oauth2Client.getToken(code)

              res.writeHead(200, { 'Content-Type': 'text/html' })
              res.end(`
                <h1>Authentication Successful!</h1>
                <p>You can close this window and return to the terminal.</p>
                <style>
                  body { font-family: Arial, sans-serif; padding: 20px; }
                  h1 { color: #4CAF50; }
                </style>
              `)

              server.close()
              resolve({
                refreshToken: tokens.refresh_token,
                accessToken: tokens.access_token,
                expiryDate: tokens.expiry_date
              })
            } catch (error) {
              res.writeHead(500, { 'Content-Type': 'text/html' })
              res.end(`
                <h1>Token Exchange Failed</h1>
                <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
              `)
              server.close()
              reject(error)
            }
          }
        } else {
          res.writeHead(404)
          res.end('Not found')
        }
      } catch (error) {
        console.error('Server error:', error)
        res.writeHead(500)
        res.end('Internal server error')
      }
    })

    server.listen(PORT, () => {
      console.log(`\n🔐 Gmail OAuth Setup`)
      console.log(`==================`)
      console.log(`\nOpening authentication URL in your browser...`)
      console.log(`If it doesn't open automatically, visit:`)
      console.log(`\n${authUrl}\n`)

      open(authUrl).catch(() => {
        console.log('Failed to open browser automatically.')
      })
    })

    server.on('error', (error) => {
      console.error('Server error:', error)
      reject(error)
    })
  })
}

async function updateEnvFile(refreshToken: string): Promise<void> {
  const envPath = path.join(__dirname, '../../.env')
  let envContent = fs.readFileSync(envPath, 'utf8')

  if (envContent.includes('GMAIL_REFRESH_TOKEN=')) {
    envContent = envContent.replace(/GMAIL_REFRESH_TOKEN=.*/, `GMAIL_REFRESH_TOKEN=${refreshToken}`)
  } else {
    envContent += `\nGMAIL_REFRESH_TOKEN=${refreshToken}`
  }

  fs.writeFileSync(envPath, envContent)
}

async function main(): Promise<void> {
  try {
    console.log('Starting Gmail authentication...')
    const result = await getRefreshToken()

    if (result.refreshToken) {
      console.log('\n✅ Authentication successful!')
      console.log('\nYour refresh token is:')
      console.log(`\n${result.refreshToken}\n`)

      const answer = await new Promise<string>((resolve) => {
        const readline = (await import('readline')).createInterface({
          input: process.stdin,
          output: process.stdout
        })

        readline.question(
          'Would you like to update your .env file automatically? (y/n) ',
          (answer) => {
            readline.close()
            resolve(answer.toLowerCase())
          }
        )
      })

      if (answer === 'y' || answer === 'yes') {
        await updateEnvFile(result.refreshToken)
        console.log('\n✅ .env file updated successfully!')
      } else {
        console.log('\nAdd this to your .env file:')
        console.log(`GMAIL_REFRESH_TOKEN=${result.refreshToken}`)
      }
    } else {
      console.error('\n❌ No refresh token received')
    }

    process.exit(0)
  } catch (error) {
    console.error('\n❌ Authentication failed:', error)
    process.exit(1)
  }
}

// Run main function
{
  main()
}
