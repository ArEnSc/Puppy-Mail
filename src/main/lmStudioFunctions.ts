// Function definitions for LM Studio function calling

export interface FunctionDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<
      string,
      {
        type: string
        description: string
      }
    >
    required?: string[]
  }
}

export interface FunctionCall {
  name: string
  arguments: string // JSON string of arguments
}

// Define available functions
export const availableFunctions: FunctionDefinition[] = [
  {
    name: 'add',
    description: 'Add two numbers together',
    parameters: {
      type: 'object',
      properties: {
        a: {
          type: 'number',
          description: 'The first number to add'
        },
        b: {
          type: 'number',
          description: 'The second number to add'
        }
      },
      required: ['a', 'b']
    }
  },
  {
    name: 'multiply',
    description: 'Multiply two numbers',
    parameters: {
      type: 'object',
      properties: {
        a: {
          type: 'number',
          description: 'The first number'
        },
        b: {
          type: 'number',
          description: 'The second number'
        }
      },
      required: ['a', 'b']
    }
  },
  {
    name: 'getCurrentTime',
    description: 'Get the current date and time',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
]

// Function implementations
export const functionImplementations: Record<string, (args: unknown) => unknown> = {
  add: (args: unknown) => {
    const params = args as { a: number; b: number }
    return params.a + params.b
  },
  multiply: (args: unknown) => {
    const params = args as { a: number; b: number }
    return params.a * params.b
  },
  getCurrentTime: () => {
    return new Date().toLocaleString()
  }
}

// Execute a function call
export async function executeFunction(functionCall: FunctionCall): Promise<{
  success: boolean
  result?: unknown
  error?: string
}> {
  try {
    const func = functionImplementations[functionCall.name]
    if (!func) {
      return {
        success: false,
        error: `Function ${functionCall.name} not found`
      }
    }

    const args = JSON.parse(functionCall.arguments)
    const result = await func(args)

    return {
      success: true,
      result
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Function execution failed'
    }
  }
}

// Format functions for the LM Studio prompt
export function formatFunctionsForPrompt(functions: FunctionDefinition[]): string {
  return `You have access to the following functions:

${functions
  .map(
    (f) => `Function: ${f.name}
Description: ${f.description}
Parameters: ${JSON.stringify(f.parameters, null, 2)}`
  )
  .join('\n\n')}

To use a function, you can either:
1. Use the special format: <|channel|>commentary to=functions.functionName <|message|>{"param1": value1, "param2": value2}
2. Or respond with: {"function_call": {"name": "function_name", "arguments": "{\\"param1\\": value1, \\"param2\\": value2}"}}

Examples:
- To add 5 and 7: <|channel|>commentary to=functions.add <|message|>{"a": 5, "b": 7}
- To multiply 6 and 8: <|channel|>commentary to=functions.multiply <|message|>{"a": 6, "b": 8}
- To get current time: <|channel|>commentary to=functions.getCurrentTime <|message|>{}

Or using JSON format:
- {"function_call": {"name": "add", "arguments": "{\\"a\\": 5, \\"b\\": 7}"}}
- {"function_call": {"name": "multiply", "arguments": "{\\"a\\": 6, \\"b\\": 8}"}}
- {"function_call": {"name": "getCurrentTime", "arguments": "{}"}}

After I execute the function, I'll provide you with the result and you can continue the conversation.`
}
