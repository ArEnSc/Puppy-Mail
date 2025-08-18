import { ipcMain } from 'electron'

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
    onComplete: () => void
  ): Promise<void> {
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

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
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
              onComplete()
              return
            }

            try {
              const parsed = JSON.parse(data)

              // Check for both 'content' and 'reasoning' fields
              const delta = parsed.choices?.[0]?.delta

              if (delta?.reasoning) {
                console.log('Sending reasoning chunk:', delta.reasoning)
                onChunk(delta.reasoning, 'reasoning')
              }

              if (delta?.content) {
                console.log('Sending content chunk:', delta.content)
                onChunk(delta.content, 'content')
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
      messages: Array<{ role: string; content: string }>
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
        }
      )
    }
  )
}
