#!/usr/bin/env node

/**
 * Test workflow with verbose logging enabled
 *
 * DEBUGGING:
 * 1. Set breakpoint on line 49 (engine.executeWorkflow)
 * 2. Set breakpoints in WorkflowEngine.ts:
 *    - executeStep() to see each step execution
 *    - evaluateCondition() to see condition evaluation
 *    - resolveStepInputs() to see input processing
 * 3. Watch the logger output in console for detailed flow
 */

import { WorkflowEngine } from '../engine/WorkflowEngine'
import { WorkflowLogger } from '../engine/WorkflowLogger'
import { WorkflowDebugger } from '../debug/WorkflowDebugger'
import { ExecutionVisualizer } from '../debug/ExecutionVisualizer'
import { StandaloneMockMailService } from '../standalone/run-workflow'
import * as fs from 'fs/promises'
import * as path from 'path'

async function runWithAllLogs(): Promise<void> {
  console.log('🔍 Running Workflow with ALL Logs Visible\n')

  // Create logger that logs EVERYTHING
  const logger = new WorkflowLogger({
    logToConsole: true, // Show all logs in console
    maxLogs: 10000 // Keep many logs
  })

  // Create services
  const mailService = new StandaloneMockMailService()
  const engine = new WorkflowEngine(mailService, logger)

  // Load workflow
  const workflowPath = process.argv[2] || path.join(__dirname, 'fixtures', 'correct-workflow.json')
  const content = await fs.readFile(workflowPath, 'utf-8')
  const workflow = JSON.parse(content)
  workflow.createdAt = new Date(workflow.createdAt)
  workflow.updatedAt = new Date(workflow.updatedAt)

  console.log('📋 Workflow:', workflow.name)
  console.log('━'.repeat(60))

  // Validate
  const validation = WorkflowDebugger.validateWorkflow(workflow)
  if (!validation.valid) {
    console.error('❌ Validation failed:', validation.errors)
    return
  }

  // Generate test data
  const { triggerData } = WorkflowDebugger.generateTestData(workflow)

  console.log('\n🚀 EXECUTING WITH FULL LOGGING...\n')
  console.log('━'.repeat(60))

  try {
    // 🎯 BREAKPOINT: Set here to step through workflow execution
    const execution = await engine.executeWorkflow(workflow, triggerData)

    console.log('━'.repeat(60))
    console.log('\n✅ EXECUTION COMPLETE\n')

    // Get ALL logs
    const allLogs = logger.getAllLogs()

    console.log(`\n📜 ALL LOGS (${allLogs.length} entries):\n`)
    console.log('━'.repeat(60))

    // Show each log entry
    allLogs.forEach((log, index) => {
      const timestamp = new Date(log.timestamp).toISOString().split('T')[1]
      const level = log.level.toUpperCase().padEnd(5)
      const context = [
        log.workflowId && `workflow:${log.workflowId}`,
        log.executionId && `exec:${log.executionId}`,
        log.stepId && `step:${log.stepId}`
      ]
        .filter(Boolean)
        .join(' ')

      console.log(`\n[${index + 1}] ${timestamp} [${level}] ${context}`)
      console.log(`    Message: ${log.message}`)

      if (log.data) {
        console.log(`    Data:`, JSON.stringify(log.data, null, 4).split('\n').join('\n    '))
      }
    })

    console.log('\n' + '━'.repeat(60))

    // Also show the nice visualization
    console.log('\n📊 EXECUTION VISUALIZATION:\n')
    console.log(ExecutionVisualizer.visualizeExecutionWithLogs(workflow, execution, allLogs))

    // Save complete logs
    const logsDir = path.join(__dirname, '..', 'logs')
    await fs.mkdir(logsDir, { recursive: true })
    const logFile = path.join(logsDir, `complete-logs-${Date.now()}.json`)
    await fs.writeFile(
      logFile,
      JSON.stringify(
        {
          workflow,
          execution,
          logs: allLogs,
          timestamp: new Date().toISOString()
        },
        null,
        2
      )
    )

    console.log(`\n💾 Complete logs saved to: ${path.relative(process.cwd(), logFile)}`)
  } catch (error) {
    console.error('\n❌ EXECUTION FAILED:', error)

    // Still show all logs on error
    const allLogs = logger.getAllLogs()
    console.log(`\n📜 ERROR LOGS (${allLogs.length} entries):`)
    allLogs.forEach((log) => {
      console.log(`[${log.level}] ${log.message}`)
      if (log.data) console.log('  Data:', log.data)
    })
  }
}

// Run
if (require.main === module) {
  runWithAllLogs().catch(console.error)
}

export { runWithAllLogs }
