import { WorkflowPlan } from '../types/workflow'
import * as fs from 'fs/promises'
import * as path from 'path'

export class WorkflowStorage {
  private workflowsDir: string
  private workflows: Map<string, WorkflowPlan> = new Map()

  constructor(baseDir: string) {
    this.workflowsDir = path.join(baseDir, 'workflows')
  }

  async initialize(): Promise<void> {
    // Ensure workflows directory exists
    await fs.mkdir(this.workflowsDir, { recursive: true })

    // Load all workflow plans from disk
    await this.loadAllWorkflows()
  }

  async saveWorkflow(workflow: WorkflowPlan): Promise<void> {
    // Save to memory
    this.workflows.set(workflow.id, workflow)

    // Save to disk as JSON
    const filePath = path.join(this.workflowsDir, `${workflow.id}.json`)
    await fs.writeFile(filePath, JSON.stringify(workflow, null, 2))
  }

  async getWorkflow(id: string): Promise<WorkflowPlan | undefined> {
    return this.workflows.get(id)
  }

  async getAllWorkflows(): Promise<WorkflowPlan[]> {
    return Array.from(this.workflows.values())
  }

  async getEnabledWorkflows(): Promise<WorkflowPlan[]> {
    return Array.from(this.workflows.values()).filter((w) => w.enabled)
  }

  async deleteWorkflow(id: string): Promise<void> {
    this.workflows.delete(id)

    const filePath = path.join(this.workflowsDir, `${id}.json`)
    try {
      await fs.unlink(filePath)
    } catch (error) {
      console.error(`Failed to delete workflow file: ${filePath}`, error)
    }
  }

  async updateWorkflow(
    id: string,
    updates: Partial<WorkflowPlan>
  ): Promise<WorkflowPlan | undefined> {
    const workflow = this.workflows.get(id)
    if (!workflow) return undefined

    const updatedWorkflow = {
      ...workflow,
      ...updates,
      updatedAt: new Date()
    }

    await this.saveWorkflow(updatedWorkflow)
    return updatedWorkflow
  }

  private async loadAllWorkflows(): Promise<void> {
    try {
      const files = await fs.readdir(this.workflowsDir)
      const jsonFiles = files.filter((f) => f.endsWith('.json'))

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.workflowsDir, file)
          const content = await fs.readFile(filePath, 'utf-8')
          const workflow = JSON.parse(content) as WorkflowPlan

          // Convert date strings back to Date objects
          workflow.createdAt = new Date(workflow.createdAt)
          workflow.updatedAt = new Date(workflow.updatedAt)

          this.workflows.set(workflow.id, workflow)
        } catch (error) {
          console.error(`Failed to load workflow from ${file}:`, error)
        }
      }
    } catch (error) {
      console.error('Failed to load workflows:', error)
    }
  }
}
