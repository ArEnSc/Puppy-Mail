#!/usr/bin/env node

import { WorkflowEngine } from '../engine/WorkflowEngine'
import { WorkflowLogger } from '../engine/WorkflowLogger'
import { WorkflowDebugger } from '../debug/WorkflowDebugger'
import { WorkflowPlan } from '../types/workflow'
import {
  MailActionService,
  EmailComposition,
  ScheduledEmail,
  LabelOperation,
  EmailMessage,
  SendEmailResult,
  ScheduleEmailResult,
  LabelOperationResult,
  ListenInboxResult,
  AnalysisResult
} from '../../types/mailActions'
import * as fs from 'fs/promises'
import * as path from 'path'

/**
 * Standalone mock implementation of MailActionService for testing
 */
class StandaloneMockMailService implements MailActionService {
  private logs: string[] = []

  async sendEmail(composition: EmailComposition): Promise<SendEmailResult> {
    this.log('sendEmail', composition)
    return {
      success: true,
      data: { messageId: `msg-${Date.now()}` }
    }
  }

  async scheduleEmail(scheduledEmail: ScheduledEmail): Promise<ScheduleEmailResult> {
    this.log('scheduleEmail', scheduledEmail)
    return {
      success: true,
      data: { scheduledId: `scheduled-${Date.now()}` }
    }
  }

  async addLabels(operation: LabelOperation): Promise<LabelOperationResult> {
    this.log('addLabels', operation)
    return { success: true }
  }

  async removeLabels(operation: LabelOperation): Promise<LabelOperationResult> {
    this.log('removeLabels', operation)
    return { success: true }
  }

  async listenForEmails(
    senders: string[],
    options?: {
      subject?: string
      labels?: string[]
      callback?: (email: EmailMessage) => void
    }
  ): Promise<ListenInboxResult> {
    this.log('listenForEmails', { senders, options })
    return {
      success: true,
      data: { listenerId: `listener-${Date.now()}` }
    }
  }

  async analysis(
    prompt: string,
    context?: {
      emails?: EmailMessage[]
      data?: Record<string, unknown>
    }
  ): Promise<AnalysisResult> {
    this.log('analysis', { prompt, context })

    // Simulate AI analysis
    const response = `Analysis Results:\n- Key points extracted\n- Action items identified\n- Summary: ${prompt}`

    return {
      success: true,
      data: response
    }
  }

  private log(method: string, data: unknown): void {
    const logEntry = `[${new Date().toISOString()}] ${method}: ${JSON.stringify(data, null, 2)}`
    this.logs.push(logEntry)
    console.log(`📧 Mock ${method} called`)
  }

  getLogs(): string[] {
    return this.logs
  }
}

/**
 * Load workflow from JSON file
 */
async function loadWorkflow(filePath: string): Promise<WorkflowPlan> {
  const content = await fs.readFile(filePath, 'utf-8')
  const workflow = JSON.parse(content)

  // Convert date strings to Date objects
  workflow.createdAt = new Date(workflow.createdAt)
  workflow.updatedAt = new Date(workflow.updatedAt)

  return workflow
}

/**
 * Main function to run workflow standalone
 */
async function runStandaloneWorkflow(): Promise<void> {
  console.log('🚀 Standalone Workflow Engine Test Runner\n')

  // 1. Create mock mail service
  const mailService = new StandaloneMockMailService()

  // 2. Create engine with logging
  const logger = new WorkflowLogger({ logToConsole: true })
  const engine = new WorkflowEngine(mailService, logger)

  // 3. Load or create test workflow
  let workflow: WorkflowPlan

  const workflowPath = process.argv[2]
  if (workflowPath) {
    console.log(`📁 Loading workflow from: ${workflowPath}`)
    workflow = await loadWorkflow(workflowPath)
  } else {
    console.log('📝 Using default test workflow')
    workflow = createTestWorkflow()
  }

  // 4. Validate workflow
  console.log('\n🔍 Validating workflow...')
  const validation = WorkflowDebugger.validateWorkflow(workflow)
  if (!validation.valid) {
    console.error('❌ Validation failed:', validation.errors)
    return
  }
  console.log('✅ Workflow valid')

  // 5. Show workflow visualization
  console.log('\n📊 Workflow Structure:')
  console.log(WorkflowDebugger.visualizeWorkflow(workflow))

  // 6. Generate test trigger data
  console.log('\n🎯 Generating trigger data...')
  const { triggerData, description } = WorkflowDebugger.generateTestData(workflow)
  console.log(`Trigger: ${description}`)

  // 7. Execute workflow
  console.log('\n▶️  Executing workflow...\n')
  console.log('─'.repeat(60))

  try {
    const execution = await engine.executeWorkflow(workflow, triggerData)

    console.log('─'.repeat(60))
    console.log('\n📋 Execution Summary:')
    console.log(WorkflowDebugger.generateExecutionTrace(execution))

    // 8. Show mail service logs
    console.log('\n📬 Mail Service Activity:')
    mailService.getLogs().forEach((log) => console.log(log))

    // 9. Export debug logs
    const debugLogs = engine.getExecutionLogs(execution.id)
    const logsDir = path.join(__dirname, '..', 'logs')
    await fs.mkdir(logsDir, { recursive: true })
    const logFile = path.join(logsDir, `workflow-run-${execution.id}.json`)
    await fs.writeFile(logFile, debugLogs, 'utf-8')
    console.log(`\n💾 Debug logs saved to: ${path.relative(process.cwd(), logFile)}`)
  } catch (error) {
    console.error('\n❌ Execution failed:', error)

    // Export logs on failure too
    const allLogs = engine.exportAllLogs()
    const logsDir = path.join(__dirname, '..', 'logs')
    await fs.mkdir(logsDir, { recursive: true })
    const errorLogFile = path.join(logsDir, `workflow-error-${Date.now()}.json`)
    await fs.writeFile(errorLogFile, allLogs, 'utf-8')
    console.log(`\n💾 Error logs saved to: ${path.relative(process.cwd(), errorLogFile)}`)
  }
}

/**
 * Create a default test workflow
 */
function createTestWorkflow(): WorkflowPlan {
  return {
    id: 'standalone-test-001',
    name: 'Standalone Test Workflow',
    description: 'Test workflow for standalone execution',
    trigger: {
      id: 'trigger-001',
      type: 'email_subject',
      config: {
        subject: 'test',
        matchType: 'contains'
      }
    },
    steps: [
      {
        id: 'step-1-analyze',
        functionName: 'analysis',
        inputs: {
          prompt: 'Analyze this email and extract key information',
          useTriggeredEmail: true
        },
        onError: {
          action: 'retry',
          retryCount: 2,
          retryDelay: 500
        }
      },
      {
        id: 'step-2-label',
        functionName: 'addLabels',
        inputs: {
          operation: {
            emailIdFromPreviousStep: 'step-1-analyze',
            labelIds: ['analyzed', 'test'],
            operation: 'add'
          }
        },
        condition: {
          type: 'previousStepOutput',
          field: 'step-1-analyze.success',
          operator: 'equals',
          value: true
        }
      }
    ],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

// Run if called directly
if (require.main === module) {
  runStandaloneWorkflow().catch(console.error)
}

export { runStandaloneWorkflow, StandaloneMockMailService }
