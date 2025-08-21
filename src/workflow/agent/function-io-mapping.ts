/**
 * Function Input/Output Mapping for AI Agents
 * This shows what each function returns and what can be used in subsequent steps
 */

export const FUNCTION_IO_MAP = {
  // TRIGGER DATA (always available)
  trigger: {
    available: {
      emailId: 'string',
      email: {
        id: 'string',
        from: { email: 'string', name: 'string | undefined' },
        to: 'EmailAddress[]',
        subject: 'string',
        body: 'string',
        labels: 'string[]'
      }
    }
  },

  // FUNCTION OUTPUTS
  analysis: {
    inputs: {
      prompt: 'required string',
      useTriggeredEmail: 'optional boolean - uses trigger.email',
      emailsFromPreviousStep: 'optional string - step ID'
    },
    outputs: {
      success: 'boolean',
      data: 'string | string[] - The analysis results'
    },
    example: {
      success: true,
      data: 'Analysis: This email contains 3 action items:\n1. Review proposal\n2. Schedule meeting\n3. Send feedback'
    }
  },

  sendEmail: {
    inputs: {
      composition: {
        to: 'required EmailAddress[]',
        subject: 'required string',
        body: 'required string OR { fromPreviousStep: "step-id.data" }',
        isHtml: 'optional boolean'
      }
    },
    outputs: {
      success: 'boolean',
      data: { messageId: 'string' }
    },
    example: {
      success: true,
      data: { messageId: 'msg-123456' }
    }
  },

  addLabels: {
    inputs: {
      operation: {
        emailId: 'string OR use emailIdFromPreviousStep',
        emailIdFromPreviousStep: 'string - step ID or "trigger"',
        labelIds: 'required string[]',
        operation: 'required "add" | "remove" | "set"'
      }
    },
    outputs: {
      success: 'boolean'
    },
    example: {
      success: true
    }
  },

  scheduleEmail: {
    inputs: {
      scheduledEmail: {
        // ... EmailComposition fields plus:
        scheduledTime: 'required Date',
        OR: { fromPreviousStep: 'string - step ID' }
      }
    },
    outputs: {
      success: 'boolean',
      data: { scheduledId: 'string' }
    }
  },

  listenForEmails: {
    inputs: {
      senders: 'required string[]',
      subject: 'optional string',
      labels: 'optional string[]'
    },
    outputs: {
      success: 'boolean',
      data: { listenerId: 'string' }
    }
  }
}

/**
 * Common patterns for data flow
 */
export const DATA_FLOW_PATTERNS = {
  // Pattern 1: Analyze email and use results
  analyzeAndUse: {
    steps: [
      {
        id: 'analyze',
        functionName: 'analysis',
        inputs: { prompt: 'Extract key info', useTriggeredEmail: true }
        // Output: { success: true, data: "analysis text" }
      },
      {
        id: 'send-summary',
        functionName: 'sendEmail',
        inputs: {
          composition: {
            to: [{ email: 'user@example.com' }],
            subject: 'Analysis Results',
            body: { fromPreviousStep: 'analyze.data' } // ← Uses analysis output
          }
        }
      }
    ]
  },

  // Pattern 2: Conditional labeling
  conditionalLabel: {
    steps: [
      {
        id: 'check-content',
        functionName: 'analysis',
        inputs: { prompt: 'Is this urgent?', useTriggeredEmail: true }
        // Output: { success: true, data: "Yes, this is urgent because..." }
      },
      {
        id: 'add-urgent-label',
        functionName: 'addLabels',
        condition: {
          type: 'previousStepOutput',
          field: 'check-content.data',
          operator: 'contains',
          value: 'urgent'
        },
        inputs: {
          operation: {
            emailIdFromPreviousStep: 'trigger', // ← Uses trigger email ID
            labelIds: ['urgent'],
            operation: 'add'
          }
        }
      }
    ]
  }
}

/**
 * Reference cheat sheet for agents
 */
export const REFERENCE_GUIDE = {
  // How to reference trigger data
  triggerReferences: {
    'useTriggeredEmail: true': 'Uses the email that triggered the workflow',
    'emailIdFromPreviousStep: "trigger"': 'Uses the email ID from trigger',
    'context.trigger.email': 'The full email object from trigger',
    'context.trigger.emailId': 'Just the email ID from trigger'
  },

  // How to reference previous step outputs
  stepReferences: {
    'fromPreviousStep: "step-id"': 'Uses entire output from step',
    'fromPreviousStep: "step-id.data"': 'Uses just the data field',
    'fromPreviousStep: "step-id.data.messageId"': 'Uses nested field',
    'field: "step-id.success"': 'Used in conditions to check if step succeeded'
  },

  // What's available from each step
  stepOutputStructure: {
    allSteps: {
      success: 'boolean - always present',
      data: 'varies by function - see function outputs',
      error: 'only present if step failed'
    }
  }
}
