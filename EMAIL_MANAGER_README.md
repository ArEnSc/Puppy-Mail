# Gmail Email Manager

A simple email manager that connects to Gmail API to poll and format emails from whitelisted senders.

## Setup

### 1. Enable Gmail API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Gmail API
4. Create OAuth 2.0 credentials (Desktop application type)
5. Download credentials and note the Client ID and Client Secret

### 2. Get Refresh Token

You'll need to get a refresh token. Here's a simple way:

1. Visit: `https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/auth/callback&response_type=code&scope=https://www.googleapis.com/auth/gmail.readonly&access_type=offline&prompt=consent`
2. Replace `YOUR_CLIENT_ID` with your actual client ID
3. Authorize the application
4. Get the authorization code from the redirect URL
5. Exchange it for tokens using a POST request to `https://oauth2.googleapis.com/token`

### 3. Configure Environment Variables

Create a `.env` file based on `.env.example`:

```env
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REDIRECT_URI=http://localhost:3000/auth/callback
GMAIL_REFRESH_TOKEN=your_refresh_token
WHITELISTED_EMAILS=sender1@example.com,sender2@example.com
POLL_INTERVAL_MINUTES=5
```

## Usage

### Basic Usage

```typescript
import { EmailService } from './src/main/emailService'

// Create service instance
const emailService = new EmailService()

// Set up email handler
emailService.onNewEmails((emails) => {
  emails.forEach((email) => {
    console.log(`New email from ${email.sender}: ${email.subject}`)
  })
})

// Start polling
emailService.startPolling()

// Stop polling when needed
// emailService.stopPolling();
```

### Direct API Usage

```typescript
import { pollEmails, formatEmail } from './src/main/emailManager'
import { getEmailConfig } from './src/main/config'

async function getEmails() {
  const config = getEmailConfig()
  const emails = await pollEmails(config, 20) // Get latest 20 emails
  const formatted = emails.map(formatEmail)
  return formatted
}
```

## API Reference

### Core Functions

#### `pollEmails(config: EmailConfig, maxResults?: number): Promise<Email[]>`

Pure function that polls Gmail for emails from whitelisted senders.

#### `formatEmail(email: Email): FormattedEmail`

Pure function that formats raw email data into a simplified structure.

### Types

```typescript
interface EmailConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  refreshToken: string
  whitelistedEmails: string[]
}

interface FormattedEmail {
  id: string
  sender: string
  subject: string
  preview: string
  timestamp: string
  hasAttachments: boolean
}
```

## Integration with Electron

To integrate with your Electron app:

```typescript
// In main process
import { EmailService } from './emailService'

const emailService = new EmailService()

// Send emails to renderer
emailService.onNewEmails((emails) => {
  mainWindow.webContents.send('new-emails', emails)
})

// Start polling on app ready
app.whenReady().then(() => {
  emailService.startPolling()
})
```
