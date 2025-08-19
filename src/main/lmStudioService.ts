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
    onChunk: (chunk: string, type?: 'content' | 'reasoning' | 'function_call') => void,
    onError: (error: string) => void,
    onComplete: () => void,
    enableFunctions: boolean = false
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
      let functionCallBuffer = ''
      let isInFunctionCall = false
      let functionCallDepth = 0

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          // Process any remaining content
          if (functionCallBuffer && enableFunctions) {
            await this.handleFunctionCall(
              functionCallBuffer,
              url,
              model,
              modifiedMessages,
              onChunk,
              onError
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
              // Process any remaining function call
              if (functionCallBuffer && enableFunctions) {
                await this.handleFunctionCall(
                  functionCallBuffer,
                  url,
                  model,
                  modifiedMessages,
                  onChunk,
                  onError
                )
              }
              onComplete()
              return
            }

            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta

              if (delta?.reasoning) {
                console.log('Sending reasoning chunk:', delta.reasoning)
                onChunk(delta.reasoning, 'reasoning')
              }

              if (delta?.content) {
                // Check if we're entering a function call
                if (
                  !isInFunctionCall &&
                  delta.content.includes('<|start|>assistant<|channel|>commentary')
                ) {
                  isInFunctionCall = true
                  functionCallDepth = 0
                  functionCallBuffer = delta.content
                  console.log('Function call detected, starting buffer')
                } else if (isInFunctionCall) {
                  // Continue buffering function call content
                  functionCallBuffer += delta.content

                  // Track JSON depth to know when function call ends
                  for (const char of delta.content) {
                    if (char === '{') functionCallDepth++
                    else if (char === '}') {
                      functionCallDepth--
                      if (functionCallDepth === 0 && functionCallBuffer.includes('{')) {
                        // Function call complete
                        console.log('Function call complete, processing...')
                        console.log('Function call buffer:', functionCallBuffer)

                        if (enableFunctions) {
                          await this.handleFunctionCall(
                            functionCallBuffer,
                            url,
                            model,
                            modifiedMessages,
                            onChunk,
                            onError
                          )
                        }

                        // Reset state
                        isInFunctionCall = false
                        functionCallBuffer = ''
                        functionCallDepth = 0
                      }
                    }
                  }
                  console.log(
                    `Buffering function call: depth=${functionCallDepth}, buffer length=${functionCallBuffer.length}`
                  )
                } else {
                  // Normal content - send it through
                  console.log('Sending normal content chunk:', delta.content)
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
    onChunk: (chunk: string, type?: 'content' | 'reasoning' | 'function_call') => void,
    onError: (error: string) => void
  ): Promise<void> {
    try {
      console.log('Checking for function call in content:', content)

      // Check for LM Studio's function calling format
      // Pattern: <|start|>assistant<|channel|>commentary to=functions.functionName ... {"param": value}
      const functionPattern = /<\|start\|>assistant<\|channel\|>commentary\s+to=functions\.(\w+).*?(\{[^}]+\})/s
      const match = content.match(functionPattern)

      if (!match) {
        // Also try the original JSON format
        const functionCallMatch = content.match(/\{[\s\S]*"function_call"[\s\S]*\}/m)
        if (!functionCallMatch) {
          return
        }

        const functionCallJson = JSON.parse(functionCallMatch[0])
        const functionCall: FunctionCall = functionCallJson.function_call
        await this.executeFunctionAndContinue(
          functionCall,
          url,
          model,
          messages,
          content,
          onChunk,
          onError
        )
      } else {
        // Parse LM Studio format
        const functionName = match[1]
        const argsJson = match[2]

        console.log('Detected function call:', functionName, 'with args:', argsJson)

        const functionCall: FunctionCall = {
          name: functionName,
          arguments: argsJson
        }

        await this.executeFunctionAndContinue(
          functionCall,
          url,
          model,
          messages,
          content, // Keep original for context
          onChunk,
          onError
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
    onChunk: (chunk: string, type?: 'content' | 'reasoning' | 'function_call') => void,
    onError: (error: string) => void
  ): Promise<void> {
    // Execute the function
    const result = await executeFunction(functionCall)

    // Send function call info as a special chunk type
    const functionCallData = {
      name: functionCall.name,
      args: JSON.parse(functionCall.arguments),
      result: result.success ? result.result : null,
      error: result.success ? null : result.error,
      timestamp: new Date()
    }

    // Send as function_call type chunk
    onChunk(JSON.stringify(functionCallData), 'function_call')

    if (!result.success) {
      console.error('Function execution failed:', {
        name: functionCall.name,
        args: functionCall.arguments,
        error: result.error
      })
      // Don't return early - let the model handle the error
    } else {
      console.log('Function execution result:', result)
    }

    // Continue the conversation with the function result
    const updatedMessages = [
      ...messages,
      { role: 'assistant', content: assistantContent },
      {
        role: 'user',
        content: `The function ${functionCall.name} returned: ${JSON.stringify(result.result)}. You can now either call another function if needed, or provide a natural response to the user based on this result.`
      }
    ]

    // Make another call to get the final response
    onChunk('\n\n', 'content')
    await this.streamMessage(url, model, updatedMessages, onChunk, onError, () => {}, true)
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
        enableFunctions || false
      )
    }
  )
}
