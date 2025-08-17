import {
  extractTextFromHtml,
  sanitizeEmailBody,
  categorizeAttachments,
  getCleanEmail
} from '../renderer/src/utils/emailSanitizer'

// Test HTML email content
const htmlEmail = `
<html>
<head>
  <style>
    .header { color: blue; }
    .footer { font-size: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Welcome to Our Newsletter!</h1>
  </div>
  
  <p>Hello <strong>John</strong>,</p>
  
  <p>We're excited to share our latest updates with you:</p>
  
  <ul>
    <li>New feature: <em>Advanced Analytics</em></li>
    <li>Improved performance by 50%</li>
    <li>Bug fixes and enhancements</li>
  </ul>
  
  <blockquote>
    "This product has transformed our workflow!" - Happy Customer
  </blockquote>
  
  <p>Check out our <a href="https://example.com">website</a> for more details.</p>
  
  <div class="footer">
    <p>Best regards,<br>The Team</p>
    <p style="color: #999;">Unsubscribe | Update Preferences</p>
  </div>
  
  <script>
    // This should be removed
    alert('Tracking script');
  </script>
</body>
</html>
`

// Test attachments
const testAttachments = [
  { id: '1', filename: 'photo.jpg', mimeType: 'image/jpeg', size: 1024000 },
  { id: '2', filename: 'document.pdf', mimeType: 'application/pdf', size: 2048000 },
  { id: '3', filename: 'video.mp4', mimeType: 'video/mp4', size: 10240000 },
  {
    id: '4',
    filename: 'spreadsheet.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 512000
  },
  { id: '5', filename: 'image.png', mimeType: 'image/png', size: 768000 }
]

console.log('🧪 Testing Email Cleaning Functions')
console.log('===================================\n')

// Test HTML extraction
console.log('1. Testing HTML to Text Extraction:')
console.log('-----------------------------------')
const extractedText = extractTextFromHtml(htmlEmail)
console.log('Extracted Text:')
console.log(extractedText)
console.log('\n')

// Test email sanitization
console.log('2. Testing Email Body Sanitization:')
console.log('-----------------------------------')
const sanitizedBody = sanitizeEmailBody(htmlEmail)
console.log('Sanitized Body:')
console.log(sanitizedBody)
console.log('\n')

// Test attachment categorization
console.log('3. Testing Attachment Categorization:')
console.log('------------------------------------')
const categorized = categorizeAttachments(testAttachments)
console.log(
  'Images:',
  categorized.images.map((a) => a.filename)
)
console.log(
  'PDFs:',
  categorized.pdfs.map((a) => a.filename)
)
console.log(
  'Videos:',
  categorized.videos.map((a) => a.filename)
)
console.log(
  'Others:',
  categorized.others.map((a) => a.filename)
)
console.log('\n')

// Test complete email cleaning
console.log('4. Testing Complete Email Cleaning:')
console.log('----------------------------------')
const cleanEmail = getCleanEmail(htmlEmail, testAttachments)
console.log('Clean Text:')
console.log(cleanEmail.text)
console.log('\nAttachment Summary:')
console.log(`- ${cleanEmail.attachments.images.length} images`)
console.log(`- ${cleanEmail.attachments.pdfs.length} PDFs`)
console.log(`- ${cleanEmail.attachments.videos.length} videos`)
console.log(`- ${cleanEmail.attachments.others.length} other files`)

console.log('\n✅ Email cleaning tests completed!')
