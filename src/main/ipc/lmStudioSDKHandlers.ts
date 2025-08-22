import { ipcMain, IpcMainEvent } from 'electron'
import { LMStudioClient, Chat } from '@lmstudio/sdk'
import { lmStudioAgentTools } from '../lmStudioAgentTools'
import type { ChatMessage } from '@lmstudio/sdk'

// Single client instance - SDK manages connection internally
let client: LMStudioClient | null = null

// Store active chat sessions
const chatSessions = new Map<string, Chat>()

export function setupLMStudioSDKHandlers(): void {
  // Connect to LM Studio
  ipcMain.handle('lmstudio:connect', async (_event, url: string = 'ws://localhost:1234') => {
    try {
      client = new LMStudioClient({ baseUrl: url })

      // Test connection by listing models
      const models = await client.llm.listLoaded()
      return {
        success: true,
        models: models.map((m) => m.identifier)
      }
    } catch (error) {
      client = null
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }
    }
  })

  // Get loaded models
  ipcMain.handle('lmstudio:getModels', async () => {
    if (!client) {
      return { success: false, error: 'Not connected to LM Studio' }
    }

    try {
      const models = await client.llm.listLoaded()
      return {
        success: true,
        models: models.map((m) => m.identifier)
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get models'
      }
    }
  })

  // Create or get chat session
  ipcMain.handle(
    'lmstudio:getOrCreateChat',
    async (_event, sessionId: string, systemPrompt?: string) => {
      let chat = chatSessions.get(sessionId)

      if (!chat) {
        chat = Chat.empty()
        if (systemPrompt) {
          chat.append('system', systemPrompt)
        }
        chatSessions.set(sessionId, chat)
      }

      return { success: true, sessionId }
    }
  )

  // Main chat handler using SDK's act() method
  ipcMain.on(
    'lmstudio:chat',
    async (
      event: IpcMainEvent,
      sessionId: string,
      modelIdentifier: string,
      userMessage: string,
      enableTools: boolean = true
    ) => {
      if (!client) {
        event.reply('lmstudio:error', { error: 'Not connected to LM Studio' })
        return
      }

      const chat = chatSessions.get(sessionId)
      if (!chat) {
        event.reply('lmstudio:error', { error: 'Chat session not found' })
        return
      }

      try {
        // Append user message
        chat.append('user', userMessage)

        // Get the model
        const models = await client.llm.listLoaded()
        const model = models.find((m) => m.identifier === modelIdentifier)

        if (!model) {
          event.reply('lmstudio:error', { error: `Model ${modelIdentifier} not found` })
          return
        }

        // Use act() with our tools
        const tools = enableTools ? lmStudioAgentTools : []

        await model.act(chat, tools, {
          onRoundStart: (roundIndex) => {
            event.reply('lmstudio:roundStart', { roundIndex })
          },
          onRoundEnd: (roundIndex) => {
            event.reply('lmstudio:roundEnd', { roundIndex })
          },
          onMessage: (message: ChatMessage) => {
            // Send the message content to frontend
            event.reply('lmstudio:message', {
              role: message.getRole(),
              content: message.getText(),
              toolCallRequests: message.getToolCallRequests(),
              toolCallResults: message.getToolCallResults()
            })
          },
          onPredictionFragment: (fragment) => {
            event.reply('lmstudio:fragment', {
              content: fragment.content,
              tokenCount: fragment.tokensCount
            })
          },
          onToolCallRequestStart: (roundIndex, callId, info) => {
            event.reply('lmstudio:toolCallStart', {
              roundIndex,
              callId,
              toolCallId: info.toolCallId
            })
          },
          onToolCallRequestNameReceived: (roundIndex, callId, name) => {
            event.reply('lmstudio:toolCallName', {
              roundIndex,
              callId,
              name
            })
          },
          onToolCallRequestEnd: (roundIndex, callId, info) => {
            event.reply('lmstudio:toolCallEnd', {
              roundIndex,
              callId,
              toolCall: info.toolCallRequest,
              rawContent: info.rawContent
            })
          },
          onToolCallRequestFinalized: (roundIndex, callId, info) => {
            event.reply('lmstudio:toolCallFinalized', {
              roundIndex,
              callId,
              toolCall: info.toolCallRequest,
              rawContent: info.rawContent
            })
          }
        })

        event.reply('lmstudio:complete', { sessionId })
      } catch (error) {
        console.error('[LMStudio] Chat error:', error)
        event.reply('lmstudio:error', {
          error: error instanceof Error ? error.message : 'Chat failed'
        })
      }
    }
  )

  // Get chat history
  ipcMain.handle('lmstudio:getChatHistory', async (_event, sessionId: string) => {
    const chat = chatSessions.get(sessionId)
    if (!chat) {
      return { success: false, error: 'Chat session not found' }
    }

    const messages = chat.getMessagesArray().map((msg) => ({
      role: msg.getRole(),
      content: msg.getText(),
      toolCallRequests: msg.getToolCallRequests(),
      toolCallResults: msg.getToolCallResults()
    }))

    return { success: true, messages }
  })

  // Clear chat session
  ipcMain.handle('lmstudio:clearChat', async (_event, sessionId: string) => {
    chatSessions.delete(sessionId)
    return { success: true }
  })

  // Disconnect
  ipcMain.handle('lmstudio:disconnect', async () => {
    client = null
    chatSessions.clear()
    return { success: true }
  })

  console.log('[LMStudio SDK] IPC handlers registered')
}
