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
  async validateConnection(url: string): Promise<{ success: boolean; models?: string[]; error?: string }> {
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

      const data = await response.json() as LMStudioModelsResponse
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

  async sendMessage(url: string, model: string, messages: Array<{ role: string; content: string }>): Promise<{ success: boolean; response?: string; error?: string }> {
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
}

export function setupLMStudioHandlers(lmStudioService: LMStudioService): void {
  ipcMain.handle('lmstudio:validate', async (_event, url: string) => {
    return lmStudioService.validateConnection(url)
  })

  ipcMain.handle('lmstudio:chat', async (_event, url: string, model: string, messages: Array<{ role: string; content: string }>) => {
    return lmStudioService.sendMessage(url, model, messages)
  })
}