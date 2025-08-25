import { ipcMain, IpcMainEvent } from 'electron'
import { LMStudioClient, Chat } from '@lmstudio/sdk'
import { emailTools } from '../tools/emailTools'
import type { ChatMessage } from '@lmstudio/sdk'
import { logInfo, logError } from '../../shared/logger'
import {
  LMSTUDIO_IPC_CHANNELS,
  LMStudioResponse,
  LMStudioConnectResponse,
  LMStudioModelsResponse,
  LMStudioChatSessionResponse,
  LMStudioChatHistoryResponse,
  LMStudioRoundStartPayload,
  LMStudioRoundEndPayload,
  LMStudioMessagePayload,
  LMStudioFragmentPayload,
  LMStudioErrorPayload,
  LMStudioCompletePayload,
  LMStudioToolCallStartPayload,
  LMStudioToolCallNamePayload,
  LMStudioToolCallEndPayload,
  LMStudioToolCallFinalizedPayload
} from '../../shared/types/lmStudio'

// Single client instance - SDK manages connection internally
let client: LMStudioClient | null = null

// Store active chat sessions
// These chat sessions are important to the LMStudio State
// Everything that is returned is just to render to UI
const chatSessions = new Map<string, Chat>()

export function setupLMStudioSDKHandlers(): void {
  // Connect to LM Studio
  ipcMain.handle(
    LMSTUDIO_IPC_CHANNELS.LMSTUDIO_CONNECT,
    async (
      _event,
      url: string = 'ws://localhost:1234'
    ): Promise<LMStudioResponse<LMStudioConnectResponse>> => {
      try {
        // Convert http:// to ws:// and https:// to wss://
        let wsUrl = url
        if (url.startsWith('http://')) {
          wsUrl = url.replace('http://', 'ws://')
        } else if (url.startsWith('https://')) {
          wsUrl = url.replace('https://', 'wss://')
        }

        logInfo('[LMStudio SDK] Connecting to:', wsUrl)
        client = new LMStudioClient({ baseUrl: wsUrl })
        // Test connection by listing models
        const models = await client.llm.listLoaded()
        return {
          success: true,
          data: {
            models: models.map((m) => m.identifier)
          }
        }
      } catch (error) {
        logError(`Error: ${error}`)
        client = null
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Connection failed'
        }
      }
    }
  )

  // Get loaded models
  ipcMain.handle(
    LMSTUDIO_IPC_CHANNELS.LMSTUDIO_GET_MODELS,
    async (): Promise<LMStudioResponse<LMStudioModelsResponse>> => {
      if (!client) {
        return { success: false, error: 'Not connected to LM Studio' }
      }

      try {
        const models = await client.llm.listLoaded()
        return {
          success: true,
          data: {
            models: models.map((m) => m.identifier)
          }
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get models'
        }
      }
    }
  )

  // Create or get chat session
  ipcMain.handle(
    LMSTUDIO_IPC_CHANNELS.LMSTUDIO_GET_OR_CREATE_CHAT,
    async (
      _event,
      sessionId: string,
      systemPrompt?: string
    ): Promise<LMStudioResponse<LMStudioChatSessionResponse>> => {
      let chat = chatSessions.get(sessionId)

      if (!chat) {
        chat = Chat.empty()
        if (systemPrompt) {
          chat.append('system', systemPrompt)
        }
        chatSessions.set(sessionId, chat)
      }

      return { success: true, data: { sessionId } }
    }
  )

  // Main chat handler using SDK's act() method
  ipcMain.on(
    LMSTUDIO_IPC_CHANNELS.LMSTUDIO_CHAT,
    async (
      event: IpcMainEvent,
      sessionId: string,
      modelIdentifier: string,
      userMessage: string,
      enableTools: boolean = true
    ) => {
      if (!client) {
        event.reply(LMSTUDIO_IPC_CHANNELS.LMSTUDIO_ERROR, {
          error: 'Not connected to LM Studio'
        } as LMStudioErrorPayload)
        return
      }

      const chat = chatSessions.get(sessionId)
      if (!chat) {
        event.reply(LMSTUDIO_IPC_CHANNELS.LMSTUDIO_ERROR, {
          error: 'Chat session not found'
        } as LMStudioErrorPayload)
        return
      }

      try {
        // Append user message
        chat.append('user', userMessage)

        // Get the model
        const models = await client.llm.listLoaded()
        const model = models.find((m) => m.identifier === modelIdentifier)

        if (!model) {
          event.reply(LMSTUDIO_IPC_CHANNELS.LMSTUDIO_ERROR, {
            error: `Model ${modelIdentifier} not found`
          } as LMStudioErrorPayload)
          return
        }

        // Use act() with our tools
        const tools = enableTools ? emailTools : []

        await model.act(chat, tools, {
          allowParallelToolExecution: false, // Explicitly enforce sequential tool execution
          onRoundStart: (roundIndex) => {
            event.reply(LMSTUDIO_IPC_CHANNELS.LMSTUDIO_ROUND_START, {
              roundIndex
            } as LMStudioRoundStartPayload)
          },
          onRoundEnd: (roundIndex) => {
            event.reply(LMSTUDIO_IPC_CHANNELS.LMSTUDIO_ROUND_END, {
              roundIndex
            } as LMStudioRoundEndPayload)
          },
          // Everything except this just provides a visual UI update
          onMessage: (message: ChatMessage) => {
            // maintain internal state
            chat.append(message)
            // send message content to update ui.
            event.reply(LMSTUDIO_IPC_CHANNELS.LMSTUDIO_MESSAGE, {
              role: message.getRole(),
              content: message.getText(),
              toolCallRequests: message.getToolCallRequests(),
              toolCallResults: message.getToolCallResults()
            } as LMStudioMessagePayload)
          },
          onPredictionFragment: (fragment) => {
            event.reply(LMSTUDIO_IPC_CHANNELS.LMSTUDIO_FRAGMENT, {
              content: fragment.content,
              tokenCount: fragment.tokensCount,
              reasoningType: fragment.reasoningType,
              isStructural: fragment.isStructural
            } as LMStudioFragmentPayload)
          },
          onToolCallRequestStart: (roundIndex, callId, info) => {
            event.reply(LMSTUDIO_IPC_CHANNELS.LMSTUDIO_TOOL_CALL_START, {
              roundIndex,
              callId,
              toolCallId: info.toolCallId
            } as LMStudioToolCallStartPayload)
          },
          onToolCallRequestNameReceived: (roundIndex, callId, name) => {
            event.reply(LMSTUDIO_IPC_CHANNELS.LMSTUDIO_TOOL_CALL_NAME, {
              roundIndex,
              callId,
              name
            } as LMStudioToolCallNamePayload)
          },
          onToolCallRequestEnd: (roundIndex, callId, info) => {
            event.reply(LMSTUDIO_IPC_CHANNELS.LMSTUDIO_TOOL_CALL_END, {
              roundIndex,
              callId,
              toolCall: info.toolCallRequest,
              rawContent: info.rawContent
            } as LMStudioToolCallEndPayload)
          },
          onToolCallRequestFinalized: (roundIndex, callId, info) => {
            event.reply(LMSTUDIO_IPC_CHANNELS.LMSTUDIO_TOOL_CALL_FINALIZED, {
              roundIndex,
              callId,
              toolCall: info.toolCallRequest,
              rawContent: info.rawContent
            } as LMStudioToolCallFinalizedPayload)
          }
        })

        event.reply(LMSTUDIO_IPC_CHANNELS.LMSTUDIO_COMPLETE, {
          sessionId
        } as LMStudioCompletePayload)
      } catch (error) {
        logError('[LMStudio] Chat error:', error)
        event.reply(LMSTUDIO_IPC_CHANNELS.LMSTUDIO_ERROR, {
          error: error instanceof Error ? error.message : 'Chat failed'
        } as LMStudioErrorPayload)
      }
    }
  )

  // Get chat history
  ipcMain.handle(
    LMSTUDIO_IPC_CHANNELS.LMSTUDIO_GET_CHAT_HISTORY,
    async (_event, sessionId: string): Promise<LMStudioResponse<LMStudioChatHistoryResponse>> => {
      const chat = chatSessions.get(sessionId)
      if (!chat) {
        return { success: false, error: 'Chat session not found' }
      }

      // might actually want to save this into the db with session id, then return visual information.
      const messages = chat.getMessagesArray().map((msg) => ({
        role: msg.getRole(),
        content: msg.getText(),
        toolCallRequests: msg.getToolCallRequests(),
        toolCallResults: msg.getToolCallResults()
      }))

      return { success: true, data: { messages } }
    }
  )

  // Clear chat session
  ipcMain.handle(
    LMSTUDIO_IPC_CHANNELS.LMSTUDIO_CLEAR_CHAT,
    async (_event, sessionId: string): Promise<LMStudioResponse> => {
      // might want to delete from the db
      chatSessions.delete(sessionId)
      return { success: true }
    }
  )

  // Disconnect
  ipcMain.handle(LMSTUDIO_IPC_CHANNELS.LMSTUDIO_DISCONNECT, async (): Promise<LMStudioResponse> => {
    client = null
    chatSessions.clear()
    return { success: true }
  })

  logInfo('[LMStudio SDK] IPC handlers registered')
}
