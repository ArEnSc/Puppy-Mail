import { WorkflowPlan } from '../types/workflow'
import { WorkflowEngine } from '../engine/WorkflowEngine'
import { WorkflowDebugger } from '../debug/WorkflowDebugger'
import { WorkflowLogger } from '../engine/WorkflowLogger'
import { MailActionService } from '../../types/mailActions'

// Example workflow for testing and debugging
const testWorkflow: WorkflowPlan = {
  id: 'test-workflow-001',
  name: 'Email Analysis Debug Workflow',
  description: 'A test workflow to demonstrate debugging capabilities',
  trigger: {
    id: 'trigger-001',
    type: 'email_subject',
    config: {
      subject: 'analyze',
      matchType: 'contains'
    }
  },
  steps: [
    {
      id: 'analyze-email',
      functionName: 'analysis',
      inputs: {
        prompt: 'Extract key points and action items from this email',
        useTriggeredEmail: true
      },
      onError: {
        action: 'retry',
        retryCount: 2,
        retryDelay: 1000
      }
    },
    {
      id: 'send-response',
      functionName: 'sendEmail',
      inputs: {
        composition: {
          fromPreviousStep: 'analyze-email.data'
        }
      },
      condition: {
        type: 'previousStepOutput',
        field: 'analyze-email.success',
        operator: 'equals',
        value: true
      },
      onError: {
        action: 'stop',
        notifyEmail: 'admin@example.com'
      }
    },
    {
      id: 'label-processed',
      functionName: 'addLabels',
      inputs: {
        operation: {
          emailIdFromPreviousStep: true,
          labelIds: ['processed', 'analyzed'],
          operation: 'add'
        }
      },
      onError: {
        action: 'continue'
      }
    }
  ],
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date()
}

// Example: How to debug a workflow
export async function debugWorkflowExample(mailActions: MailActionService): Promise<void> {
  console.log('=== WORKFLOW DEBUGGING EXAMPLE ===\n')

  // 1. Validate the workflow
  console.log('1. Validating workflow configuration...')
  const validation = WorkflowDebugger.validateWorkflow(testWorkflow)
  if (!validation.valid) {
    console.error('Workflow validation failed:', validation.errors)
    return
  }
  console.log('✅ Workflow is valid\n')

  // 2. Visualize the workflow
  console.log('2. Workflow visualization:')
  console.log(WorkflowDebugger.visualizeWorkflow(testWorkflow))
  console.log('\n')

  // 3. Generate test data
  console.log('3. Generating test data...')
  const { triggerData, description } = WorkflowDebugger.generateTestData(testWorkflow)
  console.log(`Test scenario: ${description}`)
  console.log('Trigger data:', JSON.stringify(triggerData, null, 2))
  console.log('\n')

  // 4. Create engine with logger
  const logger = new WorkflowLogger({ logToConsole: true })
  const debugEngine = new WorkflowEngine(mailActions, logger)

  // 5. Execute workflow with debugging
  console.log('4. Executing workflow with debug logging...\n')
  try {
    const execution = await debugEngine.executeWorkflow(testWorkflow, triggerData)

    // 6. Show execution trace
    console.log('\n5. Execution trace:')
    console.log(WorkflowDebugger.generateExecutionTrace(execution))

    // 7. Export logs for analysis
    console.log('\n6. Exporting execution logs...')
    const logs = debugEngine.getExecutionLogs(execution.id)
    console.log(`Logs saved (${logs.length} characters)`)

    // You could save these logs to a file:
    // await fs.writeFile(`workflow-debug-${execution.id}.json`, logs)
  } catch (error) {
    console.error('\n❌ Workflow execution failed:', error)

    // Get all logs even on failure
    const allLogs = debugEngine.exportAllLogs()
    console.log('\nFull debug logs:', allLogs)
  }
}

// Example: Step-by-step debugging
export function debugStepByStep(): void {
  console.log('\n=== STEP-BY-STEP DEBUGGING ===\n')

  // Create a debug context
  const debugContext = WorkflowDebugger.createDebugContext({
    emailId: 'debug-email-123',
    email: {
      id: 'debug-email-123',
      from: { email: 'test@example.com' },
      to: [{ email: 'recipient@example.com' }],
      subject: 'Please analyze this',
      body: 'Important information that needs analysis',
      date: new Date(),
      labels: ['inbox'],
      isRead: false,
      hasAttachment: false
    }
  })

  console.log('Debug context created:')
  console.log('- Trigger email:', debugContext.trigger.email?.subject)
  console.log('- Mock step outputs available:', Array.from(debugContext.stepOutputs.keys()))

  // You can now test individual steps or conditions with this context
}

// Example: Common debugging scenarios
export function commonDebuggingScenarios(): void {
  console.log('\n=== COMMON DEBUGGING SCENARIOS ===\n')

  console.log('1. Step failed after retries:')
  console.log('   - Check the error in step results')
  console.log('   - Verify input processing is correct')
  console.log('   - Check if the mail action service is working')
  console.log('')

  console.log('2. Condition not evaluating correctly:')
  console.log('   - Check the stepOutputs map for previous step data')
  console.log('   - Verify the field path is correct')
  console.log('   - Check the operator and value match expected types')
  console.log('')

  console.log('3. Data not passing between steps:')
  console.log('   - Ensure previous step succeeded')
  console.log('   - Check the fromPreviousStep reference format')
  console.log('   - Verify the output structure matches expectations')
  console.log('')

  console.log('4. Workflow not triggering:')
  console.log('   - Verify trigger configuration matches incoming data')
  console.log('   - Check if workflow is enabled')
  console.log('   - Ensure TriggerManager has registered the workflow')
}
