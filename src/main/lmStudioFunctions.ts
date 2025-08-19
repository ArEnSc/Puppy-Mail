// Function definitions for LM Studio function calling

export interface FunctionDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
    }>
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
  }
]

// Function implementations
export const functionImplementations: Record<string, (args: any) => any> = {
  add: (args: { a: number; b: number }) => {
    return args.a + args.b
  }
}

// Execute a function call
export async function executeFunction(functionCall: FunctionCall): Promise<{
  success: boolean
  result?: any
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

${functions.map(f => `Function: ${f.name}
Description: ${f.description}
Parameters: ${JSON.stringify(f.parameters, null, 2)}`).join('\n\n')}

To use a function, respond with a JSON object in the following format:
{
  "function_call": {
    "name": "function_name",
    "arguments": "{\"param1\": value1, \"param2\": value2}"
  }
}

After I execute the function, I'll provide you with the result and you can continue the conversation.`
}