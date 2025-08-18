/**
 * Pure functions for email sanitization and cleaning
 */

interface Attachment {
  id: string
  filename: string
  mimeType: string
  size: number
}

interface SanitizedEmail {
  text: string
  attachments: {
    images: Attachment[]
    pdfs: Attachment[]
    videos: Attachment[]
    others: Attachment[]
  }
}

/**
 * Extract plain text from HTML content
 * Uses DOMParser for reliable HTML parsing in the browser
 */
export function extractTextFromHtml(html: string): string {
  // Use DOMParser for proper HTML parsing
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Remove unwanted elements
  const elementsToRemove = doc.querySelectorAll('script, style, noscript, iframe, object, embed')
  elementsToRemove.forEach((el) => el.remove())

  // Convert block elements to ensure proper spacing
  const blockElements = doc.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre')
  blockElements.forEach((el) => {
    if (el.textContent?.trim()) {
      el.insertAdjacentText('afterend', '\n')
    }
  })

  // Handle lists
  doc.querySelectorAll('ul > li').forEach((li) => {
    li.insertAdjacentText('afterbegin', '• ')
  })

  doc.querySelectorAll('ol > li').forEach((li, index) => {
    li.insertAdjacentText('afterbegin', `${index + 1}. `)
  })

  // Handle line breaks
  doc.querySelectorAll('br').forEach((br) => {
    br.insertAdjacentText('afterend', '\n')
  })

  // Extract text
  let text = doc.body.textContent || ''

  // Clean up whitespace
  text = text
    .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with 2
    .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
    .replace(/^\s+|\s+$/gm, '') // Trim each line
    .split('\n')
    .filter((line) => line.trim()) // Remove empty lines
    .join('\n')
    .trim()

  return text
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

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Check if attachment is viewable in browser
 */
export function isViewableAttachment(mimeType: string): boolean {
  const viewableTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'video/mp4',
    'video/webm',
    'video/ogg'
  ]

  return viewableTypes.includes(mimeType.toLowerCase())
}
