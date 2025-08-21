// Function definitions fetched from the main process
import { ipc } from './ipc'

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
        enum?: string[]
        items?: {
          type: string
        }
      }
    >
    required?: string[]
  }
}

// Cache for the function definitions
let cachedFunctions: FunctionDefinition[] | null = null
let cachedFormattedPrompt: string | null = null

export async function getAvailableFunctions(): Promise<FunctionDefinition[]> {
  if (!cachedFunctions) {
    const result = await ipc.invoke<{ functions: FunctionDefinition[]; formattedPrompt: string }>(
      'lmstudio:getAvailableFunctions'
    )
    cachedFunctions = result.functions
    cachedFormattedPrompt = result.formattedPrompt
  }
  return cachedFunctions
}

export async function getFormattedFunctionsPrompt(): Promise<string> {
  if (!cachedFormattedPrompt) {
    const result = await ipc.invoke<{ functions: FunctionDefinition[]; formattedPrompt: string }>(
      'lmstudio:getAvailableFunctions'
    )
    cachedFunctions = result.functions
    cachedFormattedPrompt = result.formattedPrompt
  }
  return cachedFormattedPrompt
}

// For backwards compatibility - these will be populated on first use
export let availableFunctions: FunctionDefinition[] = []
export let formatFunctionsForPrompt = (): string => {
  console.warn('formatFunctionsForPrompt called before initialization')
  return ''
}

// Initialize on module load
getAvailableFunctions().then((functions) => {
  availableFunctions = functions
})

getFormattedFunctionsPrompt().then((prompt) => {
  formatFunctionsForPrompt = () => prompt
})
