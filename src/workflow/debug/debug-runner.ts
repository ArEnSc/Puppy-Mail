#!/usr/bin/env node

import { WorkflowEngine } from '../engine/WorkflowEngine'
import { WorkflowLogger } from '../engine/WorkflowLogger'
import { WorkflowDebugger } from './WorkflowDebugger'
import { ExecutionVisualizer } from './ExecutionVisualizer'
import { WorkflowPlan } from '../types/workflow'
import {
  MailActionService,
  MailActionResult,
  EmailMessage,
  EmailComposition,
  ScheduledEmail,
  LabelOperation
} from '../../types/mailActions'
import * as fs from 'fs/promises'
import * as path from 'path'

/**
 * Enhanced mock mail service with detailed logging
 */
class DebugMockMailService implements MailActionService {
  private callCount = 0

  async sendEmail(composition: EmailComposition): Promise<MailActionResult<{ messageId: string }>> {
    this.callCount++
    console.log(`\n📧 [${this.callCount}] Mock sendEmail called:`)
    console.log('  To:', composition.to.map((e) => e.email).join(', '))
    console.log('  Subject:', composition.subject)
    console.log('  Body:', composition.body?.substring(0, 50) + '...')

    return {
      success: true,
      data: { messageId: `msg-${Date.now()}` }
    }
  }

  async scheduleEmail(
    scheduledEmail: ScheduledEmail
  ): Promise<MailActionResult<{ scheduledId: string }>> {
    this.callCount++
    console.log(`\n📧 [${this.callCount}] Mock scheduleEmail called:`)
    console.log('  Scheduled for:', scheduledEmail.scheduledTime)

    return {
      success: true,
      data: { scheduledId: `scheduled-${Date.now()}` }
    }
  }

  async addLabels(operation: LabelOperation): Promise<MailActionResult<void>> {
    this.callCount++
    console.log(`\n📧 [${this.callCount}] Mock addLabels called:`)
    console.log('  Email ID:', operation.emailId)
    console.log('  Labels:', operation.labelIds.join(', '))
    console.log('  Operation:', operation.operation)

    return { success: true }
  }

  async removeLabels(operation: LabelOperation): Promise<MailActionResult<void>> {
    this.callCount++
    console.log(`\n📧 [${this.callCount}] Mock removeLabels called:`)
    console.log('  Email ID:', operation.emailId)
    console.log('  Labels:', operation.labelIds.join(', '))

    return { success: true }
  }

  async listenForEmails(
    senders: string[],
    options?: { subject?: string; labels?: string[]; callback?: (email: EmailMessage) => void }
  ): Promise<MailActionResult<{ listenerId: string }>> {
    this.callCount++
    console.log(`\n📧 [${this.callCount}] Mock listenForEmails called:`)
    console.log('  Senders:', senders.join(', '))
    if (options?.subject) console.log('  Subject filter:', options.subject)
    if (options?.labels) console.log('  Label filter:', options.labels.join(', '))

    return {
      success: true,
      data: { listenerId: `listener-${Date.now()}` }
    }
  }

  async analysis(
    prompt: string,
    context?: { emails?: EmailMessage[]; data?: Record<string, unknown> }
  ): Promise<MailActionResult<string | string[]>> {
    this.callCount++
    console.log(`\n📧 [${this.callCount}] Mock analysis called:`)
    console.log('  Prompt:', prompt)
    if (context?.emails) {
      console.log('  Emails provided:', context.emails.length)
      context.emails.forEach((email) => {
        console.log(`    - From: ${email.from.email}, Subject: ${email.subject}`)
      })
    }

    const response = `AI Analysis:\n- Analyzed the content\n- Found key points\n- Generated response for: "${prompt}"`

    return {
      success: true,
      data: response
    }
  }
}

/**
 * Run workflow with detailed debugging
 */
async function runDebugWorkflow(): Promise<void> {
  console.log('🔍 Workflow Debug Runner\n')
  console.log('=' + '='.repeat(59))

  // 1. Create logger with verbose output
  const logger = new WorkflowLogger({
    logToConsole: true,
    maxLogs: 5000
  })

  // 2. Create mock mail service
  const mailService = new DebugMockMailService()

  // 3. Create engine with logger
  const engine = new WorkflowEngine(mailService, logger)

  // 4. Load workflow
  const workflowPath =
    process.argv[2] || path.join(__dirname, '..', 'test', 'fixtures', 'simple-test.json')
  console.log(`\n📁 Loading workflow: ${path.basename(workflowPath)}`)

  const content = await fs.readFile(workflowPath, 'utf-8')
  const workflow: WorkflowPlan = JSON.parse(content)
  workflow.createdAt = new Date(workflow.createdAt)
  workflow.updatedAt = new Date(workflow.updatedAt)

  // 5. Validate
  console.log('\n🔍 Validating workflow...')
  const validation = WorkflowDebugger.validateWorkflow(workflow)
  if (!validation.valid) {
    console.error('❌ Validation failed:')
    validation.errors.forEach((err) => console.error('  -', err))
    return
  }
  console.log('✅ Validation passed')

  // 6. Visualize
  console.log('\n📊 Workflow Structure:')
  console.log(WorkflowDebugger.visualizeWorkflow(workflow))

  // 7. Generate test data
  console.log('\n🎯 Test Data Generation:')
  const { triggerData, description } = WorkflowDebugger.generateTestData(workflow)
  console.log(`Scenario: ${description}`)
  console.log('Trigger Data:', JSON.stringify(triggerData, null, 2))

  // 8. Execute with step-by-step output
  console.log('\n' + '='.repeat(60))
  console.log('▶️  EXECUTING WORKFLOW')
  console.log('='.repeat(60) + '\n')

  try {
    const execution = await engine.executeWorkflow(workflow, triggerData)

    console.log('\n' + '='.repeat(60))
    console.log('✅ EXECUTION COMPLETE')
    console.log('='.repeat(60))

    // 9. Get execution logs
    const executionLogs = logger.getLogsForExecution(execution.id)

    // 10. Show execution visualization with logs
    console.log('\n')
    console.log(ExecutionVisualizer.visualizeExecutionWithLogs(workflow, execution, executionLogs))

    // 11. Show timeline
    console.log('\n')
    console.log(ExecutionVisualizer.createTimeline(execution))

    // 12. Export logs
    console.log(`\n📜 Captured ${executionLogs.length} log entries`)

    const logsDir = path.join(__dirname, '..', 'logs')
    await fs.mkdir(logsDir, { recursive: true })
    const logFile = path.join(logsDir, `debug-${execution.id}.json`)
    await fs.writeFile(logFile, JSON.stringify(executionLogs, null, 2))
    console.log(`💾 Full logs saved to: ${path.relative(process.cwd(), logFile)}`)
  } catch (error) {
    console.error('\n' + '='.repeat(60))
    console.error('❌ EXECUTION FAILED')
    console.error('='.repeat(60))
    console.error('\nError:', error)

    // Save error logs
    const allLogs = logger.getAllLogs()
    const logsDir = path.join(__dirname, '..', 'logs')
    await fs.mkdir(logsDir, { recursive: true })
    const errorLogFile = path.join(logsDir, `debug-error-${Date.now()}.json`)
    await fs.writeFile(errorLogFile, JSON.stringify(allLogs, null, 2))
    console.log(`\n💾 Error logs saved to: ${path.relative(process.cwd(), errorLogFile)}`)
  }
}

// Run if called directly
if (require.main === module) {
  runDebugWorkflow().catch(console.error)
}

export { runDebugWorkflow, DebugMockMailService }
