import { ipcMain, IpcMainEvent } from 'electron'
import { LMStudioClient, Chat } from '@lmstudio/sdk'
import { lmStudioAgentTools } from '../lmStudioAgentTools'
import type { ChatMessage } from '@lmstudio/sdk'

// Import IPC channels from the shared constants
const IPC_CHANNELS = {
  LMSTUDIO_CONNECT: 'lmstudio:connect',
  LMSTUDIO_GET_MODELS: 'lmstudio:getModels',
  LMSTUDIO_GET_OR_CREATE_CHAT: 'lmstudio:getOrCreateChat',
  LMSTUDIO_CHAT: 'lmstudio:chat',
  LMSTUDIO_GET_CHAT_HISTORY: 'lmstudio:getChatHistory',
  LMSTUDIO_CLEAR_CHAT: 'lmstudio:clearChat',
  LMSTUDIO_DISCONNECT: 'lmstudio:disconnect',
  LMSTUDIO_ROUND_START: 'lmstudio:roundStart',
  LMSTUDIO_ROUND_END: 'lmstudio:roundEnd',
  LMSTUDIO_MESSAGE: 'lmstudio:message',
  LMSTUDIO_FRAGMENT: 'lmstudio:fragment',
  LMSTUDIO_TOOL_CALL_START: 'lmstudio:toolCallStart',
  LMSTUDIO_TOOL_CALL_NAME: 'lmstudio:toolCallName',
  LMSTUDIO_TOOL_CALL_END: 'lmstudio:toolCallEnd',
  LMSTUDIO_TOOL_CALL_FINALIZED: 'lmstudio:toolCallFinalized',
  LMSTUDIO_COMPLETE: 'lmstudio:complete',
  LMSTUDIO_ERROR: 'lmstudio:error'
} as const

// Single client instance - SDK manages connection internally
let client: LMStudioClient | null = null

// Store active chat sessions
const chatSessions = new Map<string, Chat>()

export function setupLMStudioSDKHandlers(): void {
  // Connect to LM Studio
  ipcMain.handle(IPC_CHANNELS.LMSTUDIO_CONNECT, async (_event, url: string = 'ws://localhost:1234') => {
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
  ipcMain.handle(IPC_CHANNELS.LMSTUDIO_GET_MODELS, async () => {
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
    IPC_CHANNELS.LMSTUDIO_GET_OR_CREATE_CHAT,
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
    IPC_CHANNELS.LMSTUDIO_CHAT,
    async (
      event: IpcMainEvent,
      sessionId: string,
      modelIdentifier: string,
      userMessage: string,
      enableTools: boolean = true
    ) => {
      if (!client) {
        event.reply(IPC_CHANNELS.LMSTUDIO_ERROR, { error: 'Not connected to LM Studio' })
        return
      }

      const chat = chatSessions.get(sessionId)
      if (!chat) {
        event.reply(IPC_CHANNELS.LMSTUDIO_ERROR, { error: 'Chat session not found' })
        return
      }

      try {
        // Append user message
        chat.append('user', userMessage)

        // Get the model
        const models = await client.llm.listLoaded()
        const model = models.find((m) => m.identifier === modelIdentifier)

        if (!model) {
          event.reply(IPC_CHANNELS.LMSTUDIO_ERROR, { error: `Model ${modelIdentifier} not found` })
          return
        }

        // Use act() with our tools
        const tools = enableTools ? lmStudioAgentTools : []

        await model.act(chat, tools, {
          onRoundStart: (roundIndex) => {
            event.reply(IPC_CHANNELS.LMSTUDIO_ROUND_START, { roundIndex })
          },
          onRoundEnd: (roundIndex) => {
            event.reply(IPC_CHANNELS.LMSTUDIO_ROUND_END, { roundIndex })
          },
          onMessage: (message: ChatMessage) => {
            // Send the message content to frontend
            event.reply(IPC_CHANNELS.LMSTUDIO_MESSAGE, {
              role: message.getRole(),
              content: message.getText(),
              toolCallRequests: message.getToolCallRequests(),
              toolCallResults: message.getToolCallResults()
            })
          },
          onPredictionFragment: (fragment) => {
            event.reply(IPC_CHANNELS.LMSTUDIO_FRAGMENT, {
              content: fragment.content,
              tokenCount: fragment.tokensCount
            })
          },
          onToolCallRequestStart: (roundIndex, callId, info) => {
            event.reply(IPC_CHANNELS.LMSTUDIO_TOOL_CALL_START, {
              roundIndex,
              callId,
              toolCallId: info.toolCallId
            })
          },
          onToolCallRequestNameReceived: (roundIndex, callId, name) => {
            event.reply(IPC_CHANNELS.LMSTUDIO_TOOL_CALL_NAME, {
              roundIndex,
              callId,
              name
            })
          },
          onToolCallRequestEnd: (roundIndex, callId, info) => {
            event.reply(IPC_CHANNELS.LMSTUDIO_TOOL_CALL_END, {
              roundIndex,
              callId,
              toolCall: info.toolCallRequest,
              rawContent: info.rawContent
            })
          },
          onToolCallRequestFinalized: (roundIndex, callId, info) => {
            event.reply(IPC_CHANNELS.LMSTUDIO_TOOL_CALL_FINALIZED, {
              roundIndex,
              callId,
              toolCall: info.toolCallRequest,
              rawContent: info.rawContent
            })
          }
        })

        event.reply(IPC_CHANNELS.LMSTUDIO_COMPLETE, { sessionId })
      } catch (error) {
        console.error('[LMStudio] Chat error:', error)
        event.reply(IPC_CHANNELS.LMSTUDIO_ERROR, {
          error: error instanceof Error ? error.message : 'Chat failed'
        })
      }
    }
  )

  // Get chat history
  ipcMain.handle(IPC_CHANNELS.LMSTUDIO_GET_CHAT_HISTORY, async (_event, sessionId: string) => {
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
  ipcMain.handle(IPC_CHANNELS.LMSTUDIO_CLEAR_CHAT, async (_event, sessionId: string) => {
    chatSessions.delete(sessionId)
    return { success: true }
  })

  // Disconnect
  ipcMain.handle(IPC_CHANNELS.LMSTUDIO_DISCONNECT, async () => {
    client = null
    chatSessions.clear()
    return { success: true }
  })

  console.log('[LMStudio SDK] IPC handlers registered')
}
