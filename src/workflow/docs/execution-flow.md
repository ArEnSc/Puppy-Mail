# Workflow Execution Flow

## Example: Email Analysis Workflow

### 1. **Trigger Phase**

```
📧 Email arrives from "important@example.com"
    ↓
🎯 TriggerManager detects match
    ↓
🚀 WorkflowEngine.executeWorkflow() called
```

### 2. **Step 1: Analysis**

```typescript
{
  id: "analyze",
  functionName: "analysis",
  inputs: {
    prompt: "Extract action items from this email",
    useTriggeredEmail: true  // ← Gets converted to actual email
  }
}
```

**Processing:**

- `useTriggeredEmail: true` → Actual email from trigger
- Calls `mailActions.analysis(prompt, { emails: [triggerEmail] })`
- Output: `{ success: true, data: "Analysis results..." }`
- Stored: `stepOutputs.set("analyze", output)`

### 3. **Step 2: Add Labels (Conditional)**

```typescript
{
  id: "add-labels",
  functionName: "addLabels",
  condition: {
    type: "previousStepOutput",
    field: "analyze.success",  // ← Checks stepOutputs.get("analyze").success
    operator: "equals",
    value: true
  },
  inputs: {
    operation: {
      emailIdFromPreviousStep: true,  // ← Gets email ID from trigger
      labelIds: ["action-required"],
      operation: "add"
    }
  }
}
```

**Processing:**

- Evaluates: `stepOutputs.get("analyze").success === true` ✓
- `emailIdFromPreviousStep: true` → Uses `context.trigger.emailId`
- Calls `mailActions.addLabels({ emailId, labelIds, operation })`
- Output stored for next step

### 4. **Step 3: Send Notification (Conditional)**

```typescript
{
  id: "send-notification",
  condition: {
    field: "add-labels.success",
    operator: "equals",
    value: true
  },
  inputs: {
    composition: {
      to: [{ email: "manager@example.com" }],
      subject: "Action Required",
      body: "An important email needs attention"
    }
  }
}
```

## Data Flow Between Steps

```
Trigger Data                    Step Outputs Map
┌─────────────────┐            ┌──────────────────────┐
│ emailId: "123"  │            │ "analyze" → {        │
│ email: {...}    │            │   success: true,     │
└────────┬────────┘            │   data: "..."        │
         │                     │ }                    │
         ↓                     │                      │
    Step 1 uses                │ "add-labels" → {     │
    trigger email              │   success: true      │
         ↓                     │ }                    │
    Step 2 checks              │                      │
    "analyze.success"          │ "send-notification"  │
         ↓                     │   → { ... }          │
    Step 3 checks              └──────────────────────┘
    "add-labels.success"
```

## Key Concepts for Agent Integration

### 1. **Step References**

- Steps can reference previous outputs: `"fromPreviousStep": "step-id.field.path"`
- Special flags: `useTriggeredEmail: true`, `emailIdFromPreviousStep: true`

### 2. **Condition Evaluation**

- Field paths: `"step-id.success"`, `"step-id.data.actionItems[0]"`
- Operators: `equals`, `contains`, `exists`, `notExists`

### 3. **Available Functions**

- `analysis` - AI analysis with prompt
- `sendEmail` - Send email with composition
- `addLabels` - Add labels to email
- `removeLabels` - Remove labels
- `scheduleEmail` - Schedule for later
- `listenForEmails` - Start monitoring

### 4. **Input Processing**

Each function has specific input requirements:

- `analysis`: needs `prompt`, optionally `useTriggeredEmail`
- `sendEmail`: needs `composition` object
- `addLabels`: needs `operation` with emailId and labelIds
