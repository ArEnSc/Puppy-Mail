#!/usr/bin/env node

import { WorkflowValidator } from '../agent/WorkflowValidator'
import { AgentWorkflowHelper } from '../agent/agent-workflow-helper'
import { WorkflowPlan } from '../types/workflow'

/**
 * Test workflow validation and agent helpers
 */
async function testAgentValidation(): Promise<void> {
  console.log('🤖 Testing Workflow Validation for AI Agents\n')

  // Test 1: Valid workflow
  console.log('Test 1: Valid workflow with proper data flow')
  console.log('─'.repeat(50))

  const validWorkflow: WorkflowPlan = {
    id: 'test-valid',
    name: 'Valid Test Workflow',
    trigger: {
      id: 'trigger-1',
      type: 'email_from',
      config: { fromAddress: 'boss@company.com' }
    },
    steps: [
      {
        id: 'analyze',
        functionName: 'analysis',
        inputs: {
          prompt: 'Is this email urgent?',
          useTriggeredEmail: true
        }
      },
      {
        id: 'label-urgent',
        functionName: 'addLabels',
        condition: {
          type: 'previousStepOutput',
          field: 'analyze.data',
          operator: 'contains',
          value: 'urgent'
        },
        inputs: {
          operation: {
            emailIdFromPreviousStep: 'trigger',
            labelIds: ['urgent', 'needs-attention'],
            operation: 'add'
          }
        }
      },
      {
        id: 'notify',
        functionName: 'sendEmail',
        condition: {
          type: 'previousStepOutput',
          field: 'label-urgent.success',
          operator: 'equals',
          value: true
        },
        inputs: {
          composition: {
            to: [{ email: 'assistant@company.com' }],
            subject: 'Urgent Email Alert',
            body: 'Analysis results from previous step'
          }
        }
      }
    ],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  const validation1 = WorkflowValidator.validateWorkflow(validWorkflow)
  console.log('Valid:', validation1.valid)
  console.log('Errors:', validation1.errors.length)
  console.log('Warnings:', validation1.warnings.length)
  console.log()

  // Test 2: Invalid references
  console.log('Test 2: Invalid step references')
  console.log('─'.repeat(50))

  const invalidWorkflow: WorkflowPlan = {
    id: 'test-invalid',
    name: 'Invalid Test Workflow',
    trigger: {
      id: 'trigger-2',
      type: 'email_subject',
      config: { subject: 'test', matchType: 'contains' }
    },
    steps: [
      {
        id: 'send-summary',
        functionName: 'sendEmail',
        inputs: {
          composition: {
            // ERROR: References non-existent step
            fromPreviousStep: 'analyze.data'
          }
        }
      },
      {
        id: 'label',
        functionName: 'addLabels',
        condition: {
          type: 'previousStepOutput',
          // ERROR: References future step
          field: 'analyze.success',
          operator: 'equals',
          value: true
        },
        inputs: {
          operation: {
            // ERROR: Invalid reference
            emailIdFromPreviousStep: 'non-existent-step',
            labelIds: ['processed'],
            operation: 'add'
          }
        }
      }
    ],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  const validation2 = WorkflowValidator.validateWorkflow(invalidWorkflow)
  console.log('Valid:', validation2.valid)
  console.log('Errors:')
  validation2.errors.forEach((error) => {
    console.log(`  - Step "${error.stepId}": ${error.message}`)
    if (error.suggestion) {
      console.log(`    Suggestion: ${error.suggestion}`)
    }
  })
  console.log()

  // Test 3: Using the agent helper
  console.log('Test 3: Agent Helper - Natural Language to Workflow')
  console.log('─'.repeat(50))

  const helper = new AgentWorkflowHelper()

  const request = {
    description:
      'When I get an email from my boss, analyze it for action items and if there are any, label it as important and send me a summary',
    trigger: {
      type: 'email_from' as const,
      config: { fromAddress: 'boss@company.com' }
    }
  }

  const result = await helper.createWorkflow(request)

  if (result.workflow) {
    console.log('✅ Successfully created workflow:')
    console.log('Steps:')
    result.workflow.steps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step.id} (${step.functionName})`)
      if (step.condition) {
        console.log(
          `     Condition: ${step.condition.field} ${step.condition.operator} ${step.condition.value}`
        )
      }
    })
  } else {
    console.log('❌ Failed to create workflow:')
    console.log('Errors:', result.errors)
    console.log('Suggestions:', result.suggestions)
  }
  console.log()

  // Test 4: Check available references
  console.log('Test 4: Available References at Each Step')
  console.log('─'.repeat(50))

  if (validWorkflow) {
    for (let i = 0; i < validWorkflow.steps.length; i++) {
      const refs = helper.getAvailableReferences(validWorkflow, i)
      console.log(`\nAt step ${i + 1} (${validWorkflow.steps[i].id}):`)
      console.log('Trigger refs:', refs.trigger.slice(0, 3).join(', '), '...')
      console.log('Previous steps:')
      Object.entries(refs.steps).forEach(([stepId, paths]) => {
        console.log(`  ${stepId}: ${paths.join(', ')}`)
      })
    }
  }
  console.log()

  // Test 5: Check compatibility
  console.log('\nTest 5: Reference Compatibility Checks')
  console.log('─'.repeat(50))

  const compatChecks = [
    {
      from: { id: 'analyze', functionName: 'analysis' },
      to: { functionName: 'sendEmail', inputField: 'body' },
      ref: 'analyze.data'
    },
    {
      from: { id: 'analyze', functionName: 'analysis' },
      to: { functionName: 'addLabels', inputField: 'emailId' },
      ref: 'analyze.emailId'
    },
    {
      from: { id: 'send', functionName: 'sendEmail' },
      to: { functionName: 'sendEmail', inputField: 'body' },
      ref: 'send.data.messageId'
    }
  ]

  compatChecks.forEach((check) => {
    const result = helper.checkStepCompatibility(check.from, check.to, check.ref)
    console.log(`\n${check.from.functionName} → ${check.to.functionName} (${check.to.inputField})`)
    console.log(`Reference: ${check.ref}`)
    console.log(`Compatible: ${result.compatible ? '✅' : '❌'}`)
    if (result.reason) console.log(`Reason: ${result.reason}`)
    if (result.suggestion) console.log(`Suggestion: ${result.suggestion}`)
  })
}

// Run the test
if (require.main === module) {
  testAgentValidation().catch(console.error)
}

export { testAgentValidation }
