import { useState } from 'react'
import { useMailActions } from '@/hooks/useMailActions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

export function MailActionTest() {
  const mailActions = useMailActions()
  const [to, setTo] = useState('test@example.com')
  const [subject, setSubject] = useState('Test Email')
  const [body, setBody] = useState('This is a test email from the Mail Action Service')
  const [result, setResult] = useState<string>('')
  const [listenerId, setListenerId] = useState<string | null>(null)
  
  const testSendEmail = async () => {
    const response = await mailActions.sendEmail({
      to: [{ email: to }],
      subject,
      body
    })
    
    if (response) {
      setResult(`Email sent successfully! Message ID: ${response.messageId}`)
    }
  }
  
  const testScheduleEmail = async () => {
    const scheduledTime = new Date()
    scheduledTime.setMinutes(scheduledTime.getMinutes() + 5)
    
    const response = await mailActions.scheduleEmail({
      to: [{ email: to }],
      subject: `${subject} (Scheduled)`,
      body,
      scheduledTime
    })
    
    if (response) {
      setResult(`Email scheduled! ID: ${response.scheduledId}`)
    }
  }
  
  const testCreateDraft = async () => {
    const response = await mailActions.createDraft({
      to: [{ email: to }],
      subject: `${subject} (Draft)`,
      body
    })
    
    if (response) {
      setResult(`Draft created! ID: ${response.draftId}`)
    }
  }
  
  const testGetLabels = async () => {
    const labels = await mailActions.getLabels()
    if (labels) {
      setResult(`Found ${labels.length} labels: ${labels.map(l => l.name).join(', ')}`)
    }
  }
  
  const testCheckInbox = async () => {
    const emails = await mailActions.checkInbox()
    if (emails) {
      setResult(`Found ${emails.length} emails in inbox`)
    }
  }
  
  const testListenToInbox = async () => {
    const response = await mailActions.listenToInbox(
      { subject: 'test' },
      (email) => {
        console.log('New email received:', email)
        setResult(`New email: ${email.subject} from ${email.from.email}`)
      }
    )
    
    if (response) {
      setListenerId(response.listenerId)
      setResult(`Started listening to inbox (ID: ${response.listenerId})`)
    }
  }
  
  const testStopListening = async () => {
    if (listenerId) {
      await mailActions.stopListening(listenerId)
      setListenerId(null)
      setResult('Stopped listening to inbox')
    }
  }
  
  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mail Action Service Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email composition form */}
          <div className="space-y-2">
            <Label htmlFor="to">To:</Label>
            <Input
              id="to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="subject">Subject:</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="body">Body:</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Email body"
              rows={4}
            />
          </div>
          
          {/* Test buttons */}
          <div className="grid grid-cols-2 gap-4">
            <Button onClick={testSendEmail} disabled={mailActions.isLoading}>
              Test Send Email
            </Button>
            
            <Button onClick={testScheduleEmail} disabled={mailActions.isLoading}>
              Test Schedule Email
            </Button>
            
            <Button onClick={testCreateDraft} disabled={mailActions.isLoading}>
              Test Create Draft
            </Button>
            
            <Button onClick={testGetLabels} disabled={mailActions.isLoading}>
              Test Get Labels
            </Button>
            
            <Button onClick={testCheckInbox} disabled={mailActions.isLoading}>
              Test Check Inbox
            </Button>
            
            <Button 
              onClick={listenerId ? testStopListening : testListenToInbox} 
              disabled={mailActions.isLoading}
              variant={listenerId ? "destructive" : "default"}
            >
              {listenerId ? 'Stop Listening' : 'Test Listen to Inbox'}
            </Button>
          </div>
          
          {/* Status display */}
          <div className="mt-6 space-y-2">
            {mailActions.isLoading && (
              <div className="flex items-center gap-2 text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </div>
            )}
            
            {mailActions.error && (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>{mailActions.error}</span>
              </div>
            )}
            
            {result && !mailActions.error && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>{result}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}