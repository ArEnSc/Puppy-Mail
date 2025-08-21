# Workflow Engine

A flexible, type-safe workflow automation engine for email processing with comprehensive debugging capabilities.

## Overview

The Workflow Engine allows you to create automated workflows that trigger on email events or timers and execute a series of steps using mail actions. Each workflow consists of:

- **Triggers**: What starts the workflow (email arrival, timer)
- **Steps**: Sequential actions to perform
- **Conditions**: Logic to control step execution
- **Error Handling**: Retry logic, fallbacks, and notifications

## Architecture

```
WorkflowService (Main API)
├── WorkflowEngine (Executes workflows with built-in logging)
├── TriggerManager (Monitors for triggers)
└── WorkflowStorage (Persists workflows)
```

### Core Components

- **WorkflowService**: Main API for managing workflows
- **WorkflowEngine**: Executes workflow plans step by step with integrated logging
- **TriggerManager**: Monitors for email/timer events
- **WorkflowStorage**: Persists workflows to disk/database
- **WorkflowLogger**: Structured logging system (integrated into engine)
- **WorkflowDebugger**: Validation and visualization tools

## Workflow Structure

```typescript
interface WorkflowPlan {
  id: string
  name: string
  description?: string
  trigger: WorkflowTrigger
  steps: WorkflowStep[]
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}
```

### Trigger Types

1. **Email From**: Triggers when email arrives from specific address
2. **Email Subject**: Triggers on emails with matching subject
3. **Timer**: Triggers at intervals or specific times

### Available Functions

- `sendEmail`: Send an email
- `scheduleEmail`: Schedule an email for later
- `addLabels`: Add labels to emails
- `removeLabels`: Remove labels from emails
- `listenForEmails`: Monitor inbox for new emails
- `analysis`: AI-powered email analysis

## Running Standalone

The workflow engine can run independently without the full application:

### 1. Quick Test Run

```bash
npm run test:workflow
```

Runs a default test workflow with mock mail services.

### 2. Run with JSON File

```bash
npm run test:workflow:json
```

Or with a custom workflow:

```bash
npm run test:workflow -- path/to/your/workflow.json
```

### 3. Interactive CLI

```bash
npm run workflow:cli
```

Interactive menu for:

- Loading workflows from files
- Creating simple workflows
- Viewing workflow structure
- Executing and debugging workflows
- Exporting logs

## Example Workflows

> **Note**: Example workflow JSON files can be found in `src/workflow/test/fixtures/`

### Simple Email Analyzer

```json
{
  "id": "analyzer-001",
  "name": "Email Analyzer",
  "trigger": {
    "type": "email_subject",
    "config": {
      "subject": "analyze",
      "matchType": "contains"
    }
  },
  "steps": [
    {
      "id": "analyze",
      "functionName": "analysis",
      "inputs": {
        "prompt": "Extract key points and action items",
        "useTriggeredEmail": true
      }
    },
    {
      "id": "add-label",
      "functionName": "addLabels",
      "inputs": {
        "operation": {
          "emailIdFromPreviousStep": true,
          "labelIds": ["analyzed"],
          "operation": "add"
        }
      }
    }
  ],
  "enabled": true,
  "createdAt": "2024-01-20T10:00:00Z",
  "updatedAt": "2024-01-20T10:00:00Z"
}
```

### Daily Summary Workflow

```json
{
  "id": "daily-summary",
  "name": "Daily Email Summary",
  "trigger": {
    "type": "timer",
    "config": {
      "specificTime": "09:00",
      "timezone": "America/New_York"
    }
  },
  "steps": [
    {
      "id": "analyze-inbox",
      "functionName": "analysis",
      "inputs": {
        "prompt": "Summarize all unread emails from the last 24 hours"
      }
    },
    {
      "id": "send-summary",
      "functionName": "sendEmail",
      "inputs": {
        "composition": {
          "to": [{ "email": "me@example.com" }],
          "subject": "Daily Email Summary",
          "body": {
            "fromPreviousStep": "analyze-inbox.data"
          }
        }
      }
    }
  ],
  "enabled": true,
  "createdAt": "2024-01-20T10:00:00Z",
  "updatedAt": "2024-01-20T10:00:00Z"
}
```

## Advanced Features

### Data Flow Between Steps

Steps can reference previous step outputs:

```json
{
  "id": "send-response",
  "functionName": "sendEmail",
  "inputs": {
    "composition": {
      "fromPreviousStep": "analyze-email.data"
    }
  }
}
```

### Conditional Execution

Steps can have conditions based on previous results:

```json
{
  "condition": {
    "type": "previousStepOutput",
    "field": "analyze.success",
    "operator": "equals",
    "value": true
  }
}
```

### Error Handling

Configure how steps handle errors:

```json
{
  "onError": {
    "action": "retry",
    "retryCount": 3,
    "retryDelay": 5000,
    "notifyEmail": "admin@example.com"
  }
}
```

Actions:

- `stop`: Stop workflow execution
- `continue`: Continue to next step
- `retry`: Retry the step
- `fallbackStep`: Jump to another step

## Debugging

### Debug Engine

Enable comprehensive logging by passing a logger to the engine:

```typescript
import { WorkflowEngine } from './engine/WorkflowEngine'
import { WorkflowLogger } from './engine/WorkflowLogger'

const logger = new WorkflowLogger({ logToConsole: true })
const engine = new WorkflowEngine(mailService, logger)
const execution = await engine.executeWorkflow(workflow, triggerData)

// Get execution logs
const logs = engine.getExecutionLogs(execution.id)
```

### Workflow Debugger

Validate and visualize workflows:

```typescript
import { WorkflowDebugger } from './debug/WorkflowDebugger'

// Validate workflow
const validation = WorkflowDebugger.validateWorkflow(workflow)
if (!validation.valid) {
  console.error('Errors:', validation.errors)
}

// Visualize workflow
console.log(WorkflowDebugger.visualizeWorkflow(workflow))

// Generate test data
const { triggerData } = WorkflowDebugger.generateTestData(workflow)
```

### Debug Output Example

```
🚀 Starting workflow execution
  Workflow: Email Analysis Debug Workflow
  Trigger: email_subject
  Total Steps: 3

✅ Step 1 (analyze-email): success
  Duration: 245ms
  Output: { success: true, data: "Analysis results..." }

⏭️ Step 2 (send-response): skipped
  Condition not met

✅ Step 3 (label-processed): success
  Duration: 89ms

✅ Workflow completed successfully
  Duration: 334ms
  Steps Executed: 3
```

## Integration

### With Main Application

```typescript
import { WorkflowService } from './workflow/WorkflowService'

// Initialize
const workflowService = new WorkflowService(mailActions, storageDir)
await workflowService.initialize()

// Create workflow
const workflow = await workflowService.createWorkflow({
  name: 'My Workflow',
  trigger: {
    /* ... */
  },
  steps: [
    /* ... */
  ]
})

// Handle incoming emails
emailService.on('newEmail', async (email) => {
  await workflowService.handleIncomingEmail(email)
})
```

### Standalone Testing

```typescript
import { StandaloneMockMailService } from './standalone/run-workflow'
import { WorkflowEngine } from './engine/WorkflowEngine'

const mockMail = new StandaloneMockMailService()
const engine = new WorkflowEngine(mockMail)

const execution = await engine.executeWorkflow(workflow, triggerData)
```

## Type Safety

The engine uses strict TypeScript types:

- No `any` types in core logic
- Type guards for runtime validation
- Proper error types
- Exhaustive type checking

## Performance

- Workflows execute asynchronously
- Steps run sequentially (parallel support planned)
- Minimal memory footprint
- Efficient trigger monitoring

## Troubleshooting

### Common Issues

1. **Step Failing After Retries**
   - Check error in step results
   - Verify input types match expected
   - Ensure mail service is responding

2. **Condition Not Evaluating**
   - Check stepOutputs contains expected data
   - Verify field path syntax
   - Ensure operator matches value type

3. **Workflow Not Triggering**
   - Verify trigger config matches data
   - Check workflow is enabled
   - Ensure TriggerManager registered workflow

4. **Data Not Passing Between Steps**
   - Confirm previous step succeeded
   - Check fromPreviousStep reference
   - Verify output structure

## Future Enhancements

- [ ] Parallel step execution
- [ ] Workflow versioning
- [ ] Visual workflow builder
- [ ] More trigger types
- [ ] Step templates
- [ ] Workflow marketplace

## Contributing

When adding new features:

1. Maintain type safety
2. Add debug logging
3. Include tests
4. Update documentation
5. Follow existing patterns

## License

Part of the EmailAgent project.
