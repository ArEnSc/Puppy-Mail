#!/usr/bin/env node

import * as readline from 'readline'
import { WorkflowPlan } from '../types/workflow'
import { WorkflowEngine } from '../engine/WorkflowEngine'
import { WorkflowLogger } from '../engine/WorkflowLogger'
import { WorkflowDebugger } from '../debug/WorkflowDebugger'
import { StandaloneMockMailService } from './run-workflow'
import * as fs from 'fs/promises'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (prompt: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

class WorkflowCLI {
  private engine: WorkflowEngine
  private mailService: StandaloneMockMailService
  private loadedWorkflow?: WorkflowPlan

  constructor() {
    this.mailService = new StandaloneMockMailService()
    const logger = new WorkflowLogger({ logToConsole: true })
    this.engine = new WorkflowEngine(this.mailService, logger)
  }

  async run(): Promise<void> {
    console.log('🚀 Workflow Engine Interactive CLI\n')

    while (true) {
      const choice = await this.showMenu()

      switch (choice) {
        case '1':
          await this.loadWorkflow()
          break
        case '2':
          await this.createWorkflow()
          break
        case '3':
          await this.viewWorkflow()
          break
        case '4':
          await this.runWorkflow()
          break
        case '5':
          await this.viewLogs()
          break
        case '6':
          console.log('👋 Goodbye!')
          rl.close()
          return
        default:
          console.log('Invalid choice, please try again.')
      }

      console.log('\n' + '─'.repeat(60) + '\n')
    }
  }

  private async showMenu(): Promise<string> {
    console.log('Menu:')
    console.log('1. Load workflow from file')
    console.log('2. Create simple workflow')
    console.log('3. View current workflow')
    console.log('4. Run workflow')
    console.log('5. View debug logs')
    console.log('6. Exit')

    return await question('\nChoice: ')
  }

  private async loadWorkflow(): Promise<void> {
    const filePath = await question('Enter workflow file path: ')

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      this.loadedWorkflow = JSON.parse(content)
      this.loadedWorkflow!.createdAt = new Date(this.loadedWorkflow!.createdAt)
      this.loadedWorkflow!.updatedAt = new Date(this.loadedWorkflow!.updatedAt)

      console.log(`✅ Loaded workflow: ${this.loadedWorkflow!.name}`)
    } catch (error) {
      console.error('❌ Failed to load workflow:', error)
    }
  }

  private async createWorkflow(): Promise<void> {
    console.log('\nCreate a simple workflow:')

    const name = await question('Workflow name: ')
    const triggerType = await question('Trigger type (email_from/email_subject/timer): ')

    const triggerConfig: Record<string, unknown> = {}

    switch (triggerType) {
      case 'email_from':
        triggerConfig.fromAddress = await question('From email address: ')
        break
      case 'email_subject':
        triggerConfig.subject = await question('Subject contains: ')
        triggerConfig.matchType = 'contains'
        break
      case 'timer':
        triggerConfig.interval = parseInt(await question('Interval in minutes: '))
        break
    }

    const functionName = await question('Step function (analysis/sendEmail/addLabels): ')

    this.loadedWorkflow = {
      id: `cli-workflow-${Date.now()}`,
      name,
      description: 'Created via CLI',
      trigger: {
        id: 'trigger-1',
        type: triggerType as 'email_from' | 'email_subject' | 'timer',
        config: triggerConfig
      },
      steps: [
        {
          id: 'step-1',
          functionName: functionName as string,
          inputs: this.getDefaultInputs(functionName)
        }
      ],
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    console.log('✅ Workflow created!')
  }

  private getDefaultInputs(functionName: string): Record<string, unknown> {
    switch (functionName) {
      case 'analysis':
        return {
          prompt: 'Analyze this email',
          useTriggeredEmail: true
        }
      case 'sendEmail':
        return {
          composition: {
            to: [{ email: 'test@example.com' }],
            subject: 'Test Email',
            body: 'This is a test'
          }
        }
      case 'addLabels':
        return {
          operation: {
            emailIdFromPreviousStep: true,
            labelIds: ['processed'],
            operation: 'add'
          }
        }
      default:
        return {}
    }
  }

  private async viewWorkflow(): Promise<void> {
    if (!this.loadedWorkflow) {
      console.log('❌ No workflow loaded')
      return
    }

    console.log('\n' + WorkflowDebugger.visualizeWorkflow(this.loadedWorkflow))
  }

  private async runWorkflow(): Promise<void> {
    if (!this.loadedWorkflow) {
      console.log('❌ No workflow loaded')
      return
    }

    // Validate first
    const validation = WorkflowDebugger.validateWorkflow(this.loadedWorkflow)
    if (!validation.valid) {
      console.error('❌ Workflow validation failed:', validation.errors)
      return
    }

    // Generate test data
    const { triggerData, description } = WorkflowDebugger.generateTestData(this.loadedWorkflow)
    console.log(`\n🎯 Trigger: ${description}`)

    const confirm = await question('Run workflow? (y/n): ')
    if (confirm.toLowerCase() !== 'y') return

    console.log('\n▶️  Executing...\n')

    try {
      const execution = await this.engine.executeWorkflow(this.loadedWorkflow, triggerData)
      console.log('\n' + WorkflowDebugger.generateExecutionTrace(execution))
    } catch (error) {
      console.error('❌ Execution failed:', error)
    }
  }

  private async viewLogs(): Promise<void> {
    const logs = this.engine.exportAllLogs()

    if (!logs || logs === '[]') {
      console.log('No logs available')
      return
    }

    const save = await question('Save logs to file? (y/n): ')
    if (save.toLowerCase() === 'y') {
      const filename = `workflow-logs-${Date.now()}.json`
      await fs.writeFile(filename, logs, 'utf-8')
      console.log(`✅ Logs saved to ${filename}`)
    } else {
      console.log('\n' + logs)
    }
  }
}

// Run the CLI
if (require.main === module) {
  const cli = new WorkflowCLI()
  cli.run().catch(console.error)
}

export { WorkflowCLI }
