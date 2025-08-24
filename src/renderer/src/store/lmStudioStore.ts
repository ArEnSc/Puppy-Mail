import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { ipc } from '@/lib/ipc'
import { LMSTUDIO_IPC_CHANNELS } from '@shared/types/lmStudio'
import type {
  LMStudioResponse,
  LMStudioChatSessionResponse,
  LMStudioFragmentPayload,
  LMStudioErrorPayload
} from '@shared/types/lmStudio'
import { logInfo, logError } from '@shared/logger'
import { API_ENDPOINTS } from '@/shared/constants'

interface ToolCall {
  name: string
  arguments?: Record<string, unknown>
}

interface FunctionCall {
  name: string
  arguments: Record<string, unknown>
  result?: unknown
  error?: string
}

interface Message {
  id: string
  role: 'system' | 'assistant' | 'user' | 'error'
  content: string
  reasoning?: string
  functionCalls?: FunctionCall[]
  timestamp: Date
  prompt?: string
  contextMessages?: Array<{ role: string; content: string }>
}

interface ChatSession {
  id: string
  systemPrompt?: string
  messages: Message[]
  isStreaming: boolean
  streamingMessageId: string | null
}

interface LMStudioState {
  // Connection state
  url: string
  model: string
  isConnected: boolean
  isValidating: boolean
  isAutoConnecting: boolean
  error: string | null
  lastValidated: Date | null

  // Chat sessions
  sessions: Record<string, ChatSession>
  activeSessionId: string | null

  // Actions - Connection
  setUrl: (url: string) => void
  setModel: (model: string) => void
  setAutoConnecting: (isAutoConnecting: boolean) => void
  connect: () => Promise<void>
  disconnect: () => void

  // Actions - Chat
  createSession: (systemPrompt?: string) => string
  setActiveSession: (sessionId: string) => void
  getActiveSession: () => ChatSession | null

  // Actions - Messages
  addMessage: (sessionId: string, message: Message) => void
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void
  appendToMessage: (sessionId: string, messageId: string, content: string) => void
  setStreamingMessage: (sessionId: string, messageId: string | null) => void

  // Actions - Sending
  sendMessage: (sessionId: string, content: string, enableTools?: boolean) => Promise<void>
  initializeChat: (
    sessionId: string,
    systemPrompt?: string
  ) => Promise<LMStudioResponse<LMStudioChatSessionResponse> | undefined>

  // Event handler registration
  registerEventHandlers: (
    sessionId: string,
    callbacks: {
      onFragment?: (
        content: string,
        reasoningType?: 'none' | 'reasoning' | 'reasoningStartTag' | 'reasoningEndTag'
      ) => void
      onError?: (error: string) => void
      onComplete?: () => void
      onToolCall?: (toolCall: ToolCall) => void
    }
  ) => () => void
}

export const useLMStudioStore = create<LMStudioState>()(
  persist(
    immer((set, get) => ({
      // Initial connection state
      url: API_ENDPOINTS.LMSTUDIO_DEFAULT_URL,
      model: '',
      isConnected: false,
      isValidating: false,
      isAutoConnecting: false,
      error: null,
      lastValidated: null,

      // Initial chat state
      sessions: {},
      activeSessionId: null,

      // Connection actions
      setUrl: (url) =>
        set((state) => {
          state.url = url
          state.error = null
        }),

      setModel: (model) =>
        set((state) => {
          state.model = model
          state.error = null
        }),

      setAutoConnecting: (isAutoConnecting) =>
        set((state) => {
          state.isAutoConnecting = isAutoConnecting
        }),

      connect: async () => {
        const state = get()
        if (!state.url) {
          set((draft) => {
            draft.error = 'URL is required'
            draft.isConnected = false
          })
          return
        }

        set((draft) => {
          draft.isValidating = true
          draft.error = null
        })

        try {
          const result = await ipc.invoke<LMStudioResponse<{ models: string[] }>>(
            LMSTUDIO_IPC_CHANNELS.LMSTUDIO_CONNECT,
            state.url
          )

          if (!result.success) {
            throw new Error(result.error || 'Failed to connect to LM Studio')
          }

          const models = result.data?.models || []
          if (models.length === 0) {
            throw new Error('No models available in LM Studio')
          }

          // If no model is selected, select the first one
          const selectedModel = state.model || models[0]

          set((draft) => {
            draft.isConnected = true
            draft.isValidating = false
            draft.error = null
            draft.lastValidated = new Date()
            draft.model = selectedModel
          })

          logInfo('Connected to LM Studio', { url: state.url, model: selectedModel })
        } catch (error) {
          set((draft) => {
            draft.isConnected = false
            draft.isValidating = false
            draft.error = error instanceof Error ? error.message : 'Connection failed'
          })
          logError('Failed to connect to LM Studio:', error)
        }
      },

      disconnect: () => {
        set((draft) => {
          draft.isConnected = false
          draft.error = null
          draft.lastValidated = null
        })

        // Disconnect via IPC
        ipc.send(LMSTUDIO_IPC_CHANNELS.LMSTUDIO_DISCONNECT)
      },

      // Chat actions
      createSession: (systemPrompt) => {
        const sessionId = `chat-${Date.now()}`

        set((draft) => {
          draft.sessions[sessionId] = {
            id: sessionId,
            systemPrompt,
            messages: [],
            isStreaming: false,
            streamingMessageId: null
          }
          draft.activeSessionId = sessionId
        })

        return sessionId
      },

      setActiveSession: (sessionId) =>
        set((state) => {
          state.activeSessionId = sessionId
        }),

      getActiveSession: () => {
        const state = get()
        return state.activeSessionId ? state.sessions[state.activeSessionId] : null
      },

      // Message actions
      addMessage: (sessionId, message) =>
        set((state) => {
          if (state.sessions[sessionId]) {
            state.sessions[sessionId].messages.push(message)
          }
        }),

      updateMessage: (sessionId, messageId, updates) =>
        set((state) => {
          const session = state.sessions[sessionId]
          if (session) {
            const messageIndex = session.messages.findIndex((m) => m.id === messageId)
            if (messageIndex !== -1) {
              Object.assign(session.messages[messageIndex], updates)
            }
          }
        }),

      appendToMessage: (sessionId, messageId, content) =>
        set((state) => {
          const session = state.sessions[sessionId]
          if (session) {
            const message = session.messages.find((m) => m.id === messageId)
            if (message) {
              message.content += content
            }
          }
        }),

      setStreamingMessage: (sessionId, messageId) =>
        set((state) => {
          if (state.sessions[sessionId]) {
            state.sessions[sessionId].streamingMessageId = messageId
            state.sessions[sessionId].isStreaming = messageId !== null
          }
        }),

      // Initialize chat
      initializeChat: async (sessionId, systemPrompt) => {
        const state = get()

        if (!state.isConnected) {
          logInfo('Not connected to LM Studio')
          return
        }

        try {
          const result = await ipc.invoke<LMStudioResponse<LMStudioChatSessionResponse>>(
            LMSTUDIO_IPC_CHANNELS.LMSTUDIO_GET_OR_CREATE_CHAT,
            sessionId,
            systemPrompt
          )

          logInfo('Chat initialized:', result)
          return result
        } catch (error) {
          logError('Error initializing chat:', error)
          return undefined
        }
      },

      // Send message
      sendMessage: async (sessionId, content, enableTools = true) => {
        const state = get()
        const session = state.sessions[sessionId]

        if (!state.isConnected || !state.model || !session || session.isStreaming) {
          logInfo('Cannot send message:', {
            connected: state.isConnected,
            model: state.model,
            sessionExists: !!session,
            streaming: session?.isStreaming
          })
          return
        }

        // Add user message
        const userMessage: Message = {
          id: crypto.randomUUID(),
          role: 'user',
          content,
          timestamp: new Date()
        }

        set((draft) => {
          draft.sessions[sessionId].messages.push(userMessage)
        })

        // Create assistant message placeholder
        const assistantMessageId = crypto.randomUUID()
        const assistantMessage: Message = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date()
        }

        set((draft) => {
          draft.sessions[sessionId].messages.push(assistantMessage)
          draft.sessions[sessionId].streamingMessageId = assistantMessageId
          draft.sessions[sessionId].isStreaming = true
        })

        // Send via IPC
        ipc.send(LMSTUDIO_IPC_CHANNELS.LMSTUDIO_CHAT, sessionId, state.model, content, enableTools)
      },

      // Event handler registration
      registerEventHandlers: (sessionId, callbacks) => {
        if (!ipc.isAvailable()) return () => {}

        const handleFragment = (_event: unknown, data: LMStudioFragmentPayload): void => {
          const state = get()
          const session = state.sessions[sessionId]

          if (session?.streamingMessageId && data.content) {
            set((draft) => {
              const message = draft.sessions[sessionId].messages.find(
                (m) => m.id === session.streamingMessageId
              )
              if (message) {
                // Append to reasoning or content based on reasoningType
                if (data.reasoningType === 'reasoning') {
                  if (!message.reasoning) {
                    message.reasoning = ''
                  }
                  message.reasoning += data.content
                } else if (data.reasoningType === 'none' || !data.reasoningType) {
                  message.content += data.content
                }
                // Skip reasoningStartTag and reasoningEndTag
              }
            })

            callbacks.onFragment?.(data.content, data.reasoningType)
          }
        }

        const handleComplete = (): void => {
          set((draft) => {
            if (draft.sessions[sessionId]) {
              const session = draft.sessions[sessionId]

              session.isStreaming = false
              session.streamingMessageId = null
            }
          })

          callbacks.onComplete?.()
        }

        const handleError = (_event: unknown, data: LMStudioErrorPayload): void => {
          logError('LM Studio error:', data.error)

          set((draft) => {
            if (draft.sessions[sessionId]) {
              draft.sessions[sessionId].isStreaming = false
              draft.sessions[sessionId].streamingMessageId = null

              // Add error message
              const errorMessage: Message = {
                id: crypto.randomUUID(),
                role: 'error',
                content: data.error,
                timestamp: new Date()
              }
              draft.sessions[sessionId].messages.push(errorMessage)
            }
          })

          callbacks.onError?.(data.error)
        }

        const handleToolCallEnd = (_event: unknown, data: { toolCall?: ToolCall }): void => {
          if (data.toolCall) {
            const state = get()
            const session = state.sessions[sessionId]

            if (session?.streamingMessageId) {
              set((draft) => {
                const message = draft.sessions[sessionId].messages.find(
                  (m) => m.id === session.streamingMessageId
                )
                if (message) {
                  const functionCall: FunctionCall = {
                    name: data.toolCall!.name,
                    arguments: data.toolCall!.arguments || {}
                  }

                  if (!message.functionCalls) {
                    message.functionCalls = []
                  }
                  message.functionCalls.push(functionCall)
                }
              })
            }

            callbacks.onToolCall?.(data.toolCall)
          }
        }

        // Register handlers
        const unsubscribeFragment = ipc.on(
          LMSTUDIO_IPC_CHANNELS.LMSTUDIO_FRAGMENT,
          handleFragment as (...args: unknown[]) => void
        )
        const unsubscribeComplete = ipc.on(
          LMSTUDIO_IPC_CHANNELS.LMSTUDIO_COMPLETE,
          handleComplete as (...args: unknown[]) => void
        )
        const unsubscribeError = ipc.on(
          LMSTUDIO_IPC_CHANNELS.LMSTUDIO_ERROR,
          handleError as (...args: unknown[]) => void
        )
        const unsubscribeToolCall = ipc.on(
          LMSTUDIO_IPC_CHANNELS.LMSTUDIO_TOOL_CALL_END,
          handleToolCallEnd as (...args: unknown[]) => void
        )

        // Return cleanup function
        return () => {
          unsubscribeFragment()
          unsubscribeComplete()
          unsubscribeError()
          unsubscribeToolCall()
        }
      }
    })),
    {
      name: 'lmstudio-store',
      partialize: (state) => ({
        url: state.url,
        model: state.model
      }),
      onRehydrateStorage: () => (state) => {
        // Log rehydration for debugging
        logInfo(
          'LMStudioStore rehydrated',
          state ? { url: state.url, model: state.model } : 'no state'
        )
      }
    }
  )
)
