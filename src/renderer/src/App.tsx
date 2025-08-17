import React, { useEffect } from 'react'
import { EmailLayout } from './components/email/EmailLayout'
import { Settings } from './components/Settings'
import { useEmailStore } from './store/emailStore'

// Mock data for demonstration
const mockEmails = [
  {
    id: '1',
    threadId: 'thread1',
    subject: 'Weekly Team Meeting Notes',
    from: { name: 'Sarah Johnson', email: 'sarah@company.com' },
    to: [{ name: 'You', email: 'you@company.com' }],
    date: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    snippet: 'Here are the key points from today\'s meeting: 1. Project timeline update...',
    body: '<p>Hi team,</p><p>Here are the key points from today\'s meeting:</p><ul><li>Project timeline update</li><li>Budget review</li><li>New team member introduction</li></ul><p>Best regards,<br>Sarah</p>',
    isRead: false,
    isStarred: true,
    isImportant: true,
    labels: ['inbox'],
    attachments: [
      { id: 'att1', filename: 'meeting-notes.pdf', mimeType: 'application/pdf', size: 245760 }
    ]
  },
  {
    id: '2',
    threadId: 'thread2',
    subject: 'Re: Project Proposal Review',
    from: { name: 'Michael Chen', email: 'mchen@client.com' },
    to: [{ name: 'You', email: 'you@company.com' }],
    date: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
    snippet: 'I\'ve reviewed the proposal and have some feedback. Overall, it looks great...',
    body: '<p>Hi,</p><p>I\'ve reviewed the proposal and have some feedback. Overall, it looks great! Just a few minor suggestions:</p><ol><li>Consider adding more details about the timeline</li><li>Include risk mitigation strategies</li></ol><p>Thanks,<br>Michael</p>',
    isRead: true,
    isStarred: false,
    isImportant: false,
    labels: ['inbox']
  },
  {
    id: '3',
    threadId: 'thread3',
    subject: 'New Feature Release - Version 2.5',
    from: { name: 'Product Team', email: 'product@company.com' },
    to: [{ name: 'All Staff', email: 'all@company.com' }],
    date: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    snippet: 'We\'re excited to announce the release of version 2.5 with several new features...',
    body: '<p>Dear team,</p><p>We\'re excited to announce the release of version 2.5 with several new features:</p><ul><li>Enhanced dashboard</li><li>Improved performance</li><li>New reporting tools</li></ul><p>Please update your applications at your earliest convenience.</p><p>Best,<br>Product Team</p>',
    isRead: false,
    isStarred: false,
    isImportant: true,
    labels: ['inbox']
  },
  {
    id: '4',
    threadId: 'thread4',
    subject: 'Lunch Meeting Tomorrow?',
    from: { name: 'Emma Wilson', email: 'emma@company.com' },
    to: [{ name: 'You', email: 'you@company.com' }],
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    snippet: 'Are you free for lunch tomorrow? I\'d like to discuss the new project...',
    body: '<p>Hey!</p><p>Are you free for lunch tomorrow? I\'d like to discuss the new project requirements with you.</p><p>Let me know what time works best for you.</p><p>Thanks,<br>Emma</p>',
    isRead: true,
    isStarred: true,
    isImportant: false,
    labels: ['inbox']
  },
  {
    id: '5',
    threadId: 'thread5',
    subject: 'Quarterly Report - Q4 2023',
    from: { name: 'Finance Department', email: 'finance@company.com' },
    to: [{ name: 'You', email: 'you@company.com' }],
    cc: [{ name: 'CEO', email: 'ceo@company.com' }, { name: 'CFO', email: 'cfo@company.com' }],
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    snippet: 'Please find attached the Q4 2023 quarterly report. Revenue increased by 23%...',
    body: '<p>Dear Team,</p><p>Please find attached the Q4 2023 quarterly report.</p><p><strong>Key Highlights:</strong></p><ul><li>Revenue increased by 23% YoY</li><li>Operating margin improved to 18%</li><li>Customer acquisition cost reduced by 15%</li></ul><p>For detailed analysis, please refer to the attached document.</p><p>Best regards,<br>Finance Department</p>',
    isRead: true,
    isStarred: false,
    isImportant: true,
    labels: ['inbox'],
    attachments: [
      { id: 'att2', filename: 'Q4-2023-Report.xlsx', mimeType: 'application/vnd.ms-excel', size: 1548288 },
      { id: 'att3', filename: 'Executive-Summary.pdf', mimeType: 'application/pdf', size: 512000 }
    ]
  },
  {
    id: '6',
    threadId: 'thread6',
    subject: 'Welcome to the Team!',
    from: { name: 'HR Department', email: 'hr@company.com' },
    to: [{ name: 'New Employee', email: 'newbie@company.com' }],
    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    snippet: 'We\'re thrilled to have you join our team! Your onboarding schedule...',
    body: '<p>Dear New Team Member,</p><p>We\'re thrilled to have you join our team!</p><p>Your onboarding schedule for the first week:</p><ul><li>Monday: HR orientation and paperwork</li><li>Tuesday: IT setup and security training</li><li>Wednesday: Department introduction</li><li>Thursday: Product training</li><li>Friday: Team lunch and Q&A</li></ul><p>Looking forward to working with you!</p><p>Best,<br>HR Team</p>',
    isRead: false,
    isStarred: false,
    isImportant: false,
    labels: ['sent']
  },
  {
    id: '7',
    threadId: 'thread7',
    subject: 'Your Order Has Been Shipped!',
    from: { name: 'Amazon', email: 'orders@amazon.com' },
    to: [{ name: 'You', email: 'you@company.com' }],
    date: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    snippet: 'Good news! Your order #123-4567890 has been shipped and is on its way...',
    body: '<p>Hello,</p><p>Good news! Your order has been shipped.</p><p><strong>Order Details:</strong></p><ul><li>Order Number: #123-4567890</li><li>Items: Wireless Mouse, USB-C Hub</li><li>Delivery Date: Tomorrow by 8 PM</li><li>Tracking Number: 1Z999AA10123456784</li></ul><p>Track your package: <a href="#">Click here</a></p><p>Thanks for shopping with us!</p>',
    isRead: false,
    isStarred: false,
    isImportant: false,
    labels: ['inbox']
  },
  {
    id: '8',
    threadId: 'thread8',
    subject: 'Draft: Marketing Campaign Ideas',
    from: { name: 'You', email: 'you@company.com' },
    to: [],
    date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
    snippet: 'Ideas for Q1 2024 marketing campaign: 1. Social media contest...',
    body: '<p>Marketing Campaign Ideas for Q1 2024:</p><ol><li>Social media contest with user-generated content</li><li>Influencer partnerships</li><li>Email newsletter redesign</li><li>Webinar series on industry trends</li></ol><p><em>Note: Need to discuss budget with finance team</em></p>',
    isRead: true,
    isStarred: false,
    isImportant: false,
    labels: ['drafts']
  },
  {
    id: '9',
    threadId: 'thread9',
    subject: 'Spam: You\'ve Won $1,000,000!!!',
    from: { name: 'TotallyLegit', email: 'scam@suspicious.com' },
    to: [{ name: 'You', email: 'you@company.com' }],
    date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    snippet: 'Congratulations! You\'ve been selected as our grand prize winner...',
    body: '<p>CONGRATULATIONS!</p><p>You\'ve won our grand prize of $1,000,000!</p><p>Click here immediately to claim your prize!</p><p><strong>This is definitely not a scam!</strong></p>',
    isRead: true,
    isStarred: false,
    isImportant: false,
    labels: ['trash']
  },
  {
    id: '10',
    threadId: 'thread10',
    subject: 'Important: Security Update Required',
    from: { name: 'IT Security', email: 'security@company.com' },
    to: [{ name: 'All Users', email: 'all@company.com' }],
    date: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    snippet: 'A critical security update is available for your workstation. Please install...',
    body: '<p>Dear User,</p><p>A critical security update is available for your workstation.</p><p><strong>Action Required:</strong></p><ul><li>Save all your work</li><li>Click on the update notification</li><li>Allow the system to restart</li></ul><p>This update patches a critical vulnerability and is mandatory for all users.</p><p>If you experience any issues, please contact IT support.</p><p>Thank you,<br>IT Security Team</p>',
    isRead: false,
    isStarred: false,
    isImportant: true,
    labels: ['inbox'],
    attachments: [
      { id: 'att4', filename: 'security-patch-notes.pdf', mimeType: 'application/pdf', size: 102400 }
    ]
  }
]

function App(): React.JSX.Element {
  const { setEmails, setFolders } = useEmailStore()
  
  useEffect(() => {
    console.log('App: Loading mock emails, count:', mockEmails.length)
    // Load mock emails
    setEmails(mockEmails)
    
    // Update folder counts based on mock data
    const inboxCount = mockEmails.filter(e => e.labels.includes('inbox') && !e.isRead).length
    const importantCount = mockEmails.filter(e => e.isImportant).length
    const sentCount = mockEmails.filter(e => e.labels.includes('sent')).length
    const draftsCount = mockEmails.filter(e => e.labels.includes('drafts')).length
    const trashCount = mockEmails.filter(e => e.labels.includes('trash')).length
    
    console.log('App: Folder counts - inbox:', inboxCount, 'important:', importantCount)
    
    setFolders([
      { id: 'inbox', name: 'Inbox', type: 'system', count: inboxCount },
      { id: 'important', name: 'Important', type: 'system', count: importantCount },
      { id: 'sent', name: 'Sent', type: 'system', count: sentCount },
      { id: 'drafts', name: 'Drafts', type: 'system', count: draftsCount },
      { id: 'trash', name: 'Trash', type: 'system', count: trashCount },
    ])
  }, [setEmails, setFolders])
  
  return (
    <>
      <EmailLayout />
      <Settings />
    </>
  )
}

export default App
