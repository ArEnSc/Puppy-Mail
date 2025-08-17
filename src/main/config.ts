import * as dotenv from 'dotenv'
import { EmailConfig } from './emailManager'

dotenv.config()

export function getEmailConfig(): EmailConfig {
  const requiredEnvVars = [
    'GMAIL_CLIENT_ID',
    'GMAIL_CLIENT_SECRET',
    'GMAIL_REDIRECT_URI',
    'GMAIL_REFRESH_TOKEN'
  ]

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`)
    }
  }

  const whitelistedEmails = process.env.WHITELISTED_EMAILS
    ? process.env.WHITELISTED_EMAILS.split(',').map((email) => email.trim())
    : []

  return {
    clientId: process.env.GMAIL_CLIENT_ID!,
    clientSecret: process.env.GMAIL_CLIENT_SECRET!,
    redirectUri: process.env.GMAIL_REDIRECT_URI!,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN!,
    whitelistedEmails
  }
}

export function getPollInterval(): number {
  return parseInt(process.env.POLL_INTERVAL_MINUTES || '5', 10)
}
