import { convert } from 'html-to-text'

export interface Attachment {
  id: string
  filename: string
  mimeType: string
  size: number
}

export interface SanitizedEmail {
  text: string
  attachments: {
    images: Attachment[]
    pdfs: Attachment[]
    videos: Attachment[]
    others: Attachment[]
  }
}

/**
 * Extract plain text from HTML content using html-to-text
 */
export function extractTextFromHtml(html: string): string {
  return convert(html, {
    wordwrap: false,
    selectors: [
      {
        selector: 'a',
        options: {
          ignoreHref: false,
          linkBrackets: ['[', ']']
        }
      },
      { selector: 'img', format: 'skip' },
      { selector: 'h1', options: { uppercase: false } },
      { selector: 'h2', options: { uppercase: false } },
      { selector: 'h3', options: { uppercase: false } },
      { selector: 'table', format: 'dataTable' },
      { selector: 'ul', options: { itemPrefix: '• ' } },
      { selector: 'style', format: 'skip' },
      { selector: 'script', format: 'skip' },
      { selector: 'noscript', format: 'skip' }
    ],
    preserveNewlines: true,
    decodeEntities: true
  })
}

/**
 * Categorize attachments by type
 */
export function categorizeAttachments(
  attachments: Attachment[] = []
): SanitizedEmail['attachments'] {
  const categorized = {
    images: [] as Attachment[],
    pdfs: [] as Attachment[],
    videos: [] as Attachment[],
    others: [] as Attachment[]
  }

  attachments.forEach((attachment) => {
    const mimeType = attachment.mimeType.toLowerCase()

    if (mimeType.startsWith('image/')) {
      categorized.images.push(attachment)
    } else if (mimeType === 'application/pdf') {
      categorized.pdfs.push(attachment)
    } else if (mimeType.startsWith('video/')) {
      categorized.videos.push(attachment)
    } else {
      categorized.others.push(attachment)
    }
  })

  return categorized
}

/**
 * Clean and sanitize email body
 */
export function sanitizeEmailBody(body: string): string {
  // First try to extract text if it looks like HTML
  if (body.includes('<') && body.includes('>')) {
    return extractTextFromHtml(body)
  }

  // If it's already plain text, just clean it up
  return body
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
    .trim()
}

/**
 * Get a clean version of the email with only text and relevant attachments
 */
export function getCleanEmail(body: string, attachments: Attachment[] = []): SanitizedEmail {
  return {
    text: sanitizeEmailBody(body),
    attachments: categorizeAttachments(attachments)
  }
}

// Helper functions for email parsing
export function extractEmailAddress(emailString: string): string {
  // Extract email from strings like "John Doe <john@example.com>"
  const match = emailString.match(/<(.+)>/)
  return match ? match[1] : emailString
}

export function extractName(emailString: string): string | undefined {
  // Extract name from strings like "John Doe <john@example.com>"
  const match = emailString.match(/^([^<]+)\s*</)
  return match ? match[1].trim() : undefined
}
