import * as dotenv from 'dotenv'
import * as path from 'path'
import { pollEmails, formatEmail, type EmailConfig } from '../main/services/email/emailManager'

dotenv.config({ path: path.join(__dirname, '../../.env') })

async function testEmailFetch(): Promise<void> {
  console.log('🧪 Testing Gmail Email Fetch')
  console.log('===========================\n')

  // Check environment variables
  const requiredEnvVars = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN']
  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName])

  if (missingVars.length > 0) {
    console.error('❌ Missing environment variables:', missingVars.join(', '))
    console.log('\nPlease run: npm run auth:gmail')
    process.exit(1)
  }

  console.log('✅ All required environment variables found\n')

  // Configure email settings
  const config: EmailConfig = {
    clientId: process.env.GMAIL_CLIENT_ID!,
    clientSecret: process.env.GMAIL_CLIENT_SECRET!,
    redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/auth/callback',
    refreshToken: process.env.GMAIL_REFRESH_TOKEN!,
    whitelistedEmails: process.env.WHITELISTED_EMAILS?.split(',') || []
  }

  console.log('📧 Email Configuration:')
  console.log('- Client ID:', config.clientId.substring(0, 20) + '...')
  console.log('- Redirect URI:', config.redirectUri)
  console.log(
    '- Whitelisted emails:',
    config.whitelistedEmails.length > 0
      ? config.whitelistedEmails.join(', ')
      : 'None (will fetch all emails)'
  )
  console.log()

  try {
    console.log('🔄 Fetching emails...\n')
    const emails = await pollEmails(config, 5) // Fetch 5 most recent emails

    if (emails.length === 0) {
      console.log('📭 No emails found')
      if (config.whitelistedEmails.length > 0) {
        console.log(
          '\nNote: You have whitelisted emails configured. Make sure you have emails from:',
          config.whitelistedEmails.join(', ')
        )
      }
    } else {
      console.log(`📬 Found ${emails.length} email(s):\n`)

      emails.forEach((email, index) => {
        const formatted = formatEmail(email)
        console.log(`Email ${index + 1}:`)
        console.log(`  From: ${formatted.sender}`)
        console.log(`  Subject: ${formatted.subject}`)
        console.log(`  Preview: ${formatted.preview}`)
        console.log(`  Date: ${new Date(formatted.timestamp).toLocaleString()}`)
        console.log(`  Has Attachments: ${formatted.hasAttachments ? 'Yes' : 'No'}`)
        console.log()
      })
    }

    console.log('✅ Email fetch test completed successfully!')
  } catch (error) {
    console.error('❌ Error fetching emails:', error)

    if (error instanceof Error) {
      if (error.message.includes('invalid_grant')) {
        console.log('\n🔄 Your refresh token may have expired. Please run: npm run auth:gmail')
      } else if (error.message.includes('Request had insufficient authentication scopes')) {
        console.log(
          '\n🔑 Insufficient permissions. Please re-authenticate with: npm run auth:gmail'
        )
      }
    }

    process.exit(1)
  }
}

// Run main function
{
  testEmailFetch()
}
