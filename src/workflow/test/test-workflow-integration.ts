#!/usr/bin/env node

/**
 * Integration test for the complete workflow system
 * Tests: Email trigger → Workflow execution → Analysis → Send email
 */

import { WorkflowEngine } from '../engine/WorkflowEngine'
import { TriggerManager } from '../engine/TriggerManager'
import { WorkflowPlan } from '../types/workflow'
import { EmailMessage, MailActionService } from '../../types/mailActions'
import * as fs from 'fs/promises'
import * as path from 'path'

// Mock implementation of MailActionService for testing
class TestMailActionService implements MailActionService {
  private logs: string[] = []

  async sendEmail(composition: any) {
    this.log('sendEmail', composition)
    console.log('📧 SENDING EMAIL:')
    console.log('  To:', composition.to)
    console.log('  Subject:', composition.subject)
    console.log('  Body:', composition.body?.substring(0, 100) + '...')
    return { 
      success: true, 
      data: { messageId: `msg-${Date.now()}` }
    }
  }

  async scheduleEmail(scheduled: any) {
    this.log('scheduleEmail', scheduled)
    return { 
      success: true, 
      data: { scheduledId: `sched-${Date.now()}` }
    }
  }

  async addLabels(operation: any) {
    this.log('addLabels', operation)
    return { success: true }
  }

  async removeLabels(operation: any) {
    this.log('removeLabels', operation)
    return { success: true }
  }

  async listenForEmails(senders: string[], options?: any) {
    this.log('listenForEmails', { senders, options })
    return { 
      success: true, 
      data: { listenerId: `listener-${Date.now()}` }
    }
  }

  async analysis(prompt: string, context?: any) {
    this.log('analysis', { prompt, context })
    console.log('🤖 RUNNING ANALYSIS:')
    console.log('  Prompt:', prompt.substring(0, 100) + '...')
    
    // Simulate AI analysis
    const result = `
Analysis Results:
- Key Point 1: The email discusses an important project update
- Key Point 2: There are action items that need attention
- Sentiment: Professional and urgent
- Suggested Response: "Thank you for the update. I will review the action items and respond by EOD."
    `.trim()
    
    return { 
      success: true, 
      data: result
    }
  }

  private log(method: string, data: any) {
    const entry = `[${new Date().toISOString()}] ${method}: ${JSON.stringify(data, null, 2)}`
    this.logs.push(entry)
  }

  getLogs() {
    return this.logs
  }
}

async function runIntegrationTest() {
  console.log('🧪 WORKFLOW INTEGRATION TEST\n')
  console.log('=' .repeat(60))

  // 1. Create services
  const mailService = new TestMailActionService()
  const engine = new WorkflowEngine(mailService)
  const triggerManager = new TriggerManager(engine)

  // 2. Load test workflow
  const workflowPath = path.join(__dirname, 'example-workflow-with-refs.json')
  const workflowContent = await fs.readFile(workflowPath, 'utf-8')
  const workflow: WorkflowPlan = JSON.parse(workflowContent)
  workflow.createdAt = new Date(workflow.createdAt)
  workflow.updatedAt = new Date(workflow.updatedAt)

  console.log('\n📋 WORKFLOW:', workflow.name)
  console.log('  Trigger:', workflow.trigger.type)
  console.log('  Steps:', workflow.steps.map(s => s.id).join(' → '))
  console.log('\n' + '=' .repeat(60))

  // 3. Register workflow with trigger manager
  triggerManager.registerWorkflow(workflow)
  console.log('\n✅ Workflow registered with trigger manager')

  // 4. Simulate incoming email
  const testEmail: EmailMessage = {
    id: 'test-email-123',
    from: { 
      email: 'client@example.com', 
      name: 'Important Client' 
    },
    to: [{ 
      email: 'user@company.com', 
      name: 'User' 
    }],
    subject: 'Urgent: Project Update Required',
    body: `
Hello,

We need an urgent update on the project status. Please review the following items:

1. Current progress on Phase 2
2. Any blockers or issues
3. Expected timeline for completion

This is critical for our quarterly review.

Best regards,
Important Client
    `.trim(),
    date: new Date(),
    labels: ['inbox', 'important'],
    isRead: false,
    hasAttachment: false,
    threadId: 'thread-123'
  }

  console.log('\n📨 SIMULATING INCOMING EMAIL:')
  console.log('  From:', testEmail.from.email)
  console.log('  Subject:', testEmail.subject)
  console.log('  Body preview:', testEmail.body.substring(0, 50) + '...')
  console.log('\n' + '=' .repeat(60))

  // 5. Trigger workflow
  console.log('\n🚀 TRIGGERING WORKFLOW...\n')
  
  try {
    await triggerManager.handleIncomingEmail(testEmail)
    
    console.log('\n' + '=' .repeat(60))
    console.log('\n✅ WORKFLOW EXECUTION COMPLETE!')
    
    // 6. Show what happened
    console.log('\n📝 EXECUTION SUMMARY:')
    const logs = mailService.getLogs()
    console.log(`  - ${logs.length} actions executed`)
    
    // Show simplified logs
    console.log('\n🔍 ACTION LOG:')
    logs.forEach((log, i) => {
      const lines = log.split('\n')
      console.log(`  ${i + 1}. ${lines[0].split('] ')[1]}`)
    })
    
  } catch (error) {
    console.error('\n❌ WORKFLOW EXECUTION FAILED:', error)
  }

  // 7. Test reference resolution
  console.log('\n' + '=' .repeat(60))
  console.log('\n🧪 TESTING REFERENCE RESOLUTION:\n')
  
  // Note: The actual step output from analysis is { success: true, data: "string" }
  // So to reference the result, we need to use {{analyze.data}} not {{analyze.result}}
  const testContext = {
    trigger: {
      type: 'email_from',
      email: testEmail,
      emailId: testEmail.id
    },
    stepOutputs: new Map([
      ['analyze', { 
        success: true, 
        data: 'Test analysis result' // This is what analysis actually returns
      }]
    ])
  }

  const testInputs = {
    composition: {
      to: ['test@example.com'],
      subject: 'Re: {{trigger.email.subject}}',
      body: 'Analysis: {{analyze.data}}'  // Fixed: use .data not .result
    }
  }

  console.log('Input with references:', JSON.stringify(testInputs, null, 2))
  
  // Access private method for testing (normally wouldn't do this)
  const resolved = (engine as any).resolveValue(testInputs, testContext)
  console.log('\nResolved output:', JSON.stringify(resolved, null, 2))

  console.log('\n' + '=' .repeat(60))
  console.log('\n🎉 INTEGRATION TEST COMPLETE!\n')
}

// Run the test
if (require.main === module) {
  runIntegrationTest().catch(console.error)
}

export { runIntegrationTest }