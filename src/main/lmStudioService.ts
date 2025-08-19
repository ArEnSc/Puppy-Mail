import { ipcMain } from 'electron'
import {
  availableFunctions,
  executeFunction,
  formatFunctionsForPrompt,
  FunctionCall
} from './lmStudioFunctions'

interface LMStudioModel {
  id: string
  object: string
  created: number
  owned_by: string
}

interface LMStudioModelsResponse {
  object: string
  data: LMStudioModel[]
}

export class LMStudioService {
  async validateConnection(
    url: string
  ): Promise<{ success: boolean; models?: string[]; error?: string }> {
    try {
      console.log('LMStudioService: Validating connection to', url)

      // Remove trailing slash if present
      const cleanUrl = url.replace(/\/$/, '')

      // Test the connection by fetching available models
      const response = await fetch(`${cleanUrl}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        // Add timeout
        signal: AbortSignal.timeout(5000)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('LMStudioService: Response not OK:', response.status, errorText)
        return {
          success: false,
          error: `LM Studio returned status ${response.status}`
        }
      }

      const data = (await response.json()) as LMStudioModelsResponse
      console.log('LMStudioService: Models response:', data)

      if (!data.data || !Array.isArray(data.data)) {
        return {
          success: false,
          error: 'Invalid response from LM Studio'
        }
      }

      const models = data.data.map((model) => model.id).filter(Boolean)

      if (models.length === 0) {
        return {
          success: false,
          error: 'No models found in LM Studio. Please load a model first.'
        }
      }

      console.log('LMStudioService: Found models:', models)
      return {
        success: true,
        models
      }
    } catch (error) {
      console.error('LMStudioService: Error validating connection:', error)

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: 'Connection timeout. Make sure LM Studio is running.'
          }
        }
        if (error.message.includes('ECONNREFUSED')) {
          return {
            success: false,
            error: 'Cannot connect to LM Studio. Make sure it is running on the specified URL.'
          }
        }
        return {
          success: false,
          error: error.message
        }
      }

      return {
        success: false,
        error: 'Failed to connect to LM Studio'
      }
    }
  }

  async sendMessage(
    url: string,
    model: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
      // Remove trailing slash if present
      const cleanUrl = url.replace(/\/$/, '')

      const response = await fetch(`${cleanUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 2000,
          stream: false
        }),
        signal: AbortSignal.timeout(30000) // 30 second timeout for completions
      })

      if (!response.ok) {
        return {
          success: false,
          error: `LM Studio returned status ${response.status}`
        }
      }

      const data = await response.json()

      if (data.choices && data.choices[0] && data.choices[0].message) {
        return {
          success: true,
          response: data.choices[0].message.content
        }
      }

      return {
        success: false,
        error: 'Invalid response format from LM Studio'
      }
    } catch (error) {
      console.error('LMStudioService: Error sending message:', error)

      if (error instanceof Error) {
        return {
          success: false,
          error: error.message
        }
      }

      return {
        success: false,
        error: 'Failed to send message to LM Studio'
      }
    }
  }

  async streamMessage(
    url: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    onChunk: (chunk: string, type?: 'content' | 'reasoning') => void,
    onError: (error: string) => void,
    onComplete: () => void,
    enableFunctions: boolean = false,
    onFunctionCall?: (functionCall: FunctionCall & { result?: unknown }) => void
  ): Promise<void> {
    try {
      // Remove trailing slash if present
      const cleanUrl = url.replace(/\/$/, '')

      // Modify messages to include function definitions if enabled
      const modifiedMessages = [...messages]
      if (enableFunctions && messages.length > 0) {
        // Add function definitions to the system message or create one
        const systemMessageIndex = modifiedMessages.findIndex((m) => m.role === 'system')
        const functionsPrompt = formatFunctionsForPrompt(availableFunctions)

        if (systemMessageIndex >= 0) {
          modifiedMessages[systemMessageIndex].content += '\n\n' + functionsPrompt
        } else {
          modifiedMessages.unshift({
            role: 'system',
            content: functionsPrompt
          })
        }
      }

      const response = await fetch(`${cleanUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: modifiedMessages,
          temperature: 0.7,
          max_tokens: 2000,
          stream: true
        }),
        signal: AbortSignal.timeout(60000) // 60 second timeout for streaming
      })

      if (!response.ok) {
        onError(`LM Studio returned status ${response.status}`)
        return
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        onError('No response body')
        return
      }

      let buffer = ''
      let inFunctionCall = false
      let functionCallBuffer = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          // Check if we have a buffered function call
          if (inFunctionCall && functionCallBuffer) {
            console.log('=== PROCESSING BUFFERED FUNCTION CALL ===')
            console.log('Buffer content:', functionCallBuffer)
            console.log('Buffer length:', functionCallBuffer.length)
            console.log('=========================================')
            await this.handleFunctionCall(
              functionCallBuffer,
              url,
              model,
              modifiedMessages,
              onChunk,
              onError,
              onFunctionCall
            )
          }
          onComplete()
          break
        }

        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE messages
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)

            if (data === '[DONE]') {
              // Check if we have a buffered function call
              if (inFunctionCall && functionCallBuffer) {
                console.log('=== PROCESSING BUFFERED FUNCTION CALL AT STREAM END ===')
                console.log('Buffer content:', functionCallBuffer)
                console.log('Buffer length:', functionCallBuffer.length)
                console.log('=======================================================')
                await this.handleFunctionCall(
                  functionCallBuffer,
                  url,
                  model,
                  modifiedMessages,
                  onChunk,
                  onError,
                  onFunctionCall
                )
              }
              onComplete()
              return
            }

            try {
              const parsed = JSON.parse(data)

              // Check for both 'content' and 'reasoning' fields
              const delta = parsed.choices?.[0]?.delta

              if (delta?.reasoning) {
                // console.log('Sending reasoning chunk:', delta.reasoning)
                onChunk(delta.reasoning, 'reasoning')
              }

              if (delta?.content) {
                // console.log('Raw content chunk:', delta.content)

                // Check if we're entering a function call
                if (
                  !inFunctionCall &&
                  delta.content.includes('<|start|>assistant<|channel|>commentary to=functions.')
                ) {
                  console.log('Detected function call start token')
                  inFunctionCall = true
                  functionCallBuffer = delta.content
                } else if (inFunctionCall) {
                  // We're in a function call, buffer the content
                  functionCallBuffer += delta.content
                  console.log('Buffering function call content:', delta.content)
                } else {
                  // Normal content, send it through
                  onChunk(delta.content, 'content')
                }
              }
            } catch (e) {
              console.warn('Failed to parse SSE data:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('LMStudioService: Error streaming message:', error)

      if (error instanceof Error) {
        onError(error.message)
      } else {
        onError('Failed to stream message from LM Studio')
      }
    }
  }

  private async handleFunctionCall(
    content: string,
    url: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    onChunk: (chunk: string, type?: 'content' | 'reasoning') => void,
    onError: (error: string) => void,
    onFunctionCall?: (functionCall: FunctionCall & { result?: unknown }) => void
  ): Promise<void> {
    try {
      console.log('Checking for function call in content:', content)

      // Check for LM Studio's function calling format
      // Pattern: to=functions.functionName ... {"param": value} or {}
      const functionPattern = /to=functions\.(\w+).*?(\{[^}]*\})/s
      const match = content.match(functionPattern)

      if (!match) {
        console.log('No LM Studio format match found, trying JSON format...')
        // Also try the original JSON format
        const functionCallMatch = content.match(/\{[\s\S]*"function_call"[\s\S]*\}/m)
        if (!functionCallMatch) {
          console.log('No function call found in content')
          return
        }

        console.log('Found JSON function call:', functionCallMatch[0])
        const functionCallJson = JSON.parse(functionCallMatch[0])
        const functionCall: FunctionCall = functionCallJson.function_call
        console.log('Parsed function call:', functionCall)
        await this.executeFunctionAndContinue(
          functionCall,
          url,
          model,
          messages,
          content,
          onChunk,
          onError,
          onFunctionCall
        )
      } else {
        // Parse LM Studio format
        console.log('Found LM Studio format match:', match[0])
        const functionName = match[1]
        const argsJson = match[2]

        console.log('Detected function call:', functionName, 'with args:', argsJson)

        const functionCall: FunctionCall = {
          name: functionName,
          arguments: argsJson
        }

        console.log('Executing function call:', functionCall)

        await this.executeFunctionAndContinue(
          functionCall,
          url,
          model,
          messages,
          content,
          onChunk,
          onError,
          onFunctionCall
        )
      }
    } catch (error) {
      console.error('Error handling function call:', error)
    }
  }

  private async executeFunctionAndContinue(
    functionCall: FunctionCall,
    url: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    assistantContent: string,
    onChunk: (chunk: string, type?: 'content' | 'reasoning') => void,
    onError: (error: string) => void,
    onFunctionCall?: (functionCall: FunctionCall & { result?: unknown }) => void
  ): Promise<void> {
    console.log('[executeFunctionAndContinue] Starting function execution:', functionCall.name)

    // Execute the function
    const result = await executeFunction(functionCall)

    if (!result.success) {
      console.error('[executeFunctionAndContinue] Function failed:', result.error)
      onError(`Function execution failed: ${result.error}`)
      return
    }

    console.log('[executeFunctionAndContinue] Function execution result:', result)

    // Emit the function call with its result
    if (onFunctionCall) {
      console.log('[executeFunctionAndContinue] Emitting function call to UI')
      onFunctionCall({
        ...functionCall,
        result: result.result
      })
    }

    // Don't send function result as content - it's handled by the LLM's response
    // after the function call completes

    // Continue the conversation with the function result
    const updatedMessages = [
      ...messages,
      { role: 'assistant', content: assistantContent },
      {
        role: 'user',
        content: `The function ${functionCall.name} returned: ${JSON.stringify(result.result)}. You can now either call another function if needed, or provide a natural response to the user based on this result.`
      }
    ]

    console.log('[executeFunctionAndContinue] Making recursive call to continue conversation')
    console.log('[executeFunctionAndContinue] Updated messages count:', updatedMessages.length)

    // Make another call to get the final response
    await this.streamMessage(
      url,
      model,
      updatedMessages,
      onChunk,
      onError,
      () => {
        console.log('[executeFunctionAndContinue] Recursive stream completed')
      },
      true,
      onFunctionCall
    )

    console.log('[executeFunctionAndContinue] Finished recursive call')
  }
}

export function setupLMStudioHandlers(lmStudioService: LMStudioService): void {
  ipcMain.handle('lmstudio:validate', async (_event, url: string) => {
    return lmStudioService.validateConnection(url)
  })

  ipcMain.handle(
    'lmstudio:chat',
    async (
      _event,
      url: string,
      model: string,
      messages: Array<{ role: string; content: string }>
    ) => {
      return lmStudioService.sendMessage(url, model, messages)
    }
  )

  // Streaming handler
  ipcMain.on(
    'lmstudio:stream',
    async (
      event,
      url: string,
      model: string,
      messages: Array<{ role: string; content: string }>,
      enableFunctions?: boolean
    ) => {
      const webContents = event.sender

      await lmStudioService.streamMessage(
        url,
        model,
        messages,
        (chunk, type) => {
          if (!webContents.isDestroyed()) {
            webContents.send('lmstudio:stream:chunk', { chunk, type: type || 'content' })
          }
        },
        (error) => {
          if (!webContents.isDestroyed()) {
            webContents.send('lmstudio:stream:error', error)
          }
        },
        () => {
          if (!webContents.isDestroyed()) {
            webContents.send('lmstudio:stream:complete')
          }
        },
        enableFunctions || false,
        // Add function call callback
        (functionCall) => {
          if (!webContents.isDestroyed()) {
            webContents.send('lmstudio:stream:functionCall', functionCall)
          }
        }
      )
    }
  )
}
