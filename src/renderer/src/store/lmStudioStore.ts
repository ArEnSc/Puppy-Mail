import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { enableMapSet } from 'immer'
import { ipc } from '@/lib/ipc'
import { LMSTUDIO_IPC_CHANNELS } from '@shared/types/lmStudio'

// Enable MapSet plugin for Immer to support Map and Set
enableMapSet()
import type {
  LMStudioResponse,
  LMStudioChatSessionResponse,
  LMStudioFragmentPayload,
  LMStudioErrorPayload,
  LMStudioToolCallStartPayload,
  LMStudioToolCallNamePayload,
  LMStudioToolCallEndPayload,
  LMStudioToolCallFinalizedPayload,
  LMStudioMessagePayload
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
  isStreaming?: boolean
  toolCallId?: string
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

interface ToolCallTracker {
  roundIndex: number
  callId: number
  toolCallId?: string
  name?: string
  functionCallIndex?: number
}

interface ChatSession {
  id: string
  systemPrompt?: string
  messages: Message[]
  isStreaming: boolean
  streamingMessageId: string | null
  activeToolCalls?: Map<string, ToolCallTracker>
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

        // Get updated session state after adding user message
        const updatedSession = get().sessions[sessionId]

        // Prepare context messages for debugging (all messages including the one just added)
        const contextMessages = updatedSession.messages.map((msg) => ({
          role: msg.role,
          content: msg.content
        }))

        // Create assistant message placeholder with debugging info
        const assistantMessageId = crypto.randomUUID()
        const assistantMessage: Message = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          prompt: session.systemPrompt,
          contextMessages: contextMessages
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
            // Skip structural fragments - they're likely special tokens
            if (data.isStructural) {
              return
            }

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

              // Clean up streaming tool calls
              if (session.streamingMessageId) {
                const message = session.messages.find((m) => m.id === session.streamingMessageId)
                if (message?.functionCalls) {
                  message.functionCalls.forEach((call) => {
                    if (call.isStreaming) {
                      call.isStreaming = false
                    }
                  })
                }
              }

              session.activeToolCalls = undefined
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

        const handleToolCallStart = (_event: unknown, data: LMStudioToolCallStartPayload): void => {
          const key = `${data.roundIndex}-${data.callId}`

          set((draft) => {
            const session = draft.sessions[sessionId]
            if (session) {
              if (!session.activeToolCalls) {
                session.activeToolCalls = new Map()
              }

              const tracker: ToolCallTracker = {
                roundIndex: data.roundIndex,
                callId: data.callId,
                toolCallId: data.toolCallId
              }

              if (session.streamingMessageId) {
                const message = session.messages.find((m) => m.id === session.streamingMessageId)
                if (message) {
                  if (!message.functionCalls) {
                    message.functionCalls = []
                  }

                  const functionCall: FunctionCall = {
                    name: 'Loading...',
                    arguments: {},
                    isStreaming: true,
                    toolCallId: data.toolCallId
                  }

                  tracker.functionCallIndex = message.functionCalls.length
                  message.functionCalls.push(functionCall)
                }
              }

              session.activeToolCalls.set(key, tracker)
            }
          })
        }

        const handleToolCallName = (_event: unknown, data: LMStudioToolCallNamePayload): void => {
          const key = `${data.roundIndex}-${data.callId}`

          set((draft) => {
            const session = draft.sessions[sessionId]
            const tracker = session?.activeToolCalls?.get(key)

            if (tracker) {
              tracker.name = data.name

              if (session.streamingMessageId && tracker.functionCallIndex !== undefined) {
                const message = session.messages.find((m) => m.id === session.streamingMessageId)
                if (message?.functionCalls?.[tracker.functionCallIndex]) {
                  message.functionCalls[tracker.functionCallIndex].name = data.name
                }
              }
            }
          })
        }

        const handleToolCallEnd = (_event: unknown, data: LMStudioToolCallEndPayload): void => {
          const key = `${data.roundIndex}-${data.callId}`

          set((draft) => {
            const session = draft.sessions[sessionId]
            const tracker = session?.activeToolCalls?.get(key)

            if (tracker && session.streamingMessageId) {
              const message = session.messages.find((m) => m.id === session.streamingMessageId)

              if (
                message &&
                tracker.functionCallIndex !== undefined &&
                message.functionCalls?.[tracker.functionCallIndex]
              ) {
                const toolCallData = data.toolCall
                if (toolCallData) {
                  const functionCall = message.functionCalls[tracker.functionCallIndex]
                  functionCall.name = toolCallData.name || tracker.name || 'Unknown'
                  functionCall.arguments = toolCallData.arguments || {}
                  functionCall.isStreaming = false
                }
              }
            }
          })

          if (data.toolCall && data.toolCall.name) {
            callbacks.onToolCall?.({
              name: data.toolCall.name,
              arguments: data.toolCall.arguments
            })
          }
        }

        const handleToolCallFinalized = (
          _event: unknown,
          data: LMStudioToolCallFinalizedPayload
        ): void => {
          const key = `${data.roundIndex}-${data.callId}`

          set((draft) => {
            const session = draft.sessions[sessionId]
            const tracker = session?.activeToolCalls?.get(key)

            if (tracker && session.streamingMessageId) {
              const message = session.messages.find((m) => m.id === session.streamingMessageId)

              if (
                message &&
                tracker.functionCallIndex !== undefined &&
                message.functionCalls?.[tracker.functionCallIndex]
              ) {
                const toolCallData = data.toolCall
                if (toolCallData) {
                  const functionCall = message.functionCalls[tracker.functionCallIndex]
                  functionCall.name = toolCallData.name || functionCall.name
                  functionCall.arguments = toolCallData.arguments || functionCall.arguments
                  functionCall.isStreaming = false
                }
              }

              session.activeToolCalls?.delete(key)
            }
          })
        }

        // Handle message events which include tool call results
        const handleMessage = (_event: unknown, data: LMStudioMessagePayload): void => {
          logInfo('Received message with potential tool results:', data)

          // Tool results come as part of messages after tool execution
          if (
            data.toolCallResults &&
            Array.isArray(data.toolCallResults) &&
            data.toolCallResults.length > 0
          ) {
            const state = get()
            const session = state.sessions[sessionId]

            if (session) {
              set((draft) => {
                // Find the most recent assistant message with function calls
                const messages = draft.sessions[sessionId].messages
                const lastAssistantMessage = [...messages]
                  .reverse()
                  .find(
                    (m) => m.role === 'assistant' && m.functionCalls && m.functionCalls.length > 0
                  )

                if (
                  lastAssistantMessage &&
                  lastAssistantMessage.functionCalls &&
                  data.toolCallResults
                ) {
                  // Map tool results to function calls by toolCallId
                  data.toolCallResults.forEach((result: unknown) => {
                    if (result && typeof result === 'object') {
                      const toolResult = result as { toolCallId?: string; content?: unknown }

                      // Find the matching function call by toolCallId
                      const matchingCall = lastAssistantMessage.functionCalls!.find(
                        (call) => call.toolCallId === toolResult.toolCallId
                      )

                      if (matchingCall) {
                        // Update the matching function call with its result
                        matchingCall.result = toolResult.content || result
                        logInfo('Tool call result:', {
                          toolCallId: matchingCall.toolCallId,
                          result: matchingCall.result,
                          rawResult: result,
                          toolResultContent: toolResult.content
                        })
                      } else {
                        // Fallback to index-based mapping if toolCallId is not available
                        if (data.toolCallRequests) {
                          const results = data.toolCallRequests
                          const index = results.indexOf(result)
                          if (lastAssistantMessage.functionCalls![index]) {
                            lastAssistantMessage.functionCalls![index].result =
                              toolResult.content || result
                          }
                        }
                      }
                    }
                  })
                }
              })
            }
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
        const unsubscribeMessage = ipc.on(
          LMSTUDIO_IPC_CHANNELS.LMSTUDIO_MESSAGE,
          handleMessage as (...args: unknown[]) => void
        )
        const unsubscribeToolCallStart = ipc.on(
          LMSTUDIO_IPC_CHANNELS.LMSTUDIO_TOOL_CALL_START,
          handleToolCallStart as (...args: unknown[]) => void
        )
        const unsubscribeToolCallName = ipc.on(
          LMSTUDIO_IPC_CHANNELS.LMSTUDIO_TOOL_CALL_NAME,
          handleToolCallName as (...args: unknown[]) => void
        )
        const unsubscribeToolCallEnd = ipc.on(
          LMSTUDIO_IPC_CHANNELS.LMSTUDIO_TOOL_CALL_END,
          handleToolCallEnd as (...args: unknown[]) => void
        )
        const unsubscribeToolCallFinalized = ipc.on(
          LMSTUDIO_IPC_CHANNELS.LMSTUDIO_TOOL_CALL_FINALIZED,
          handleToolCallFinalized as (...args: unknown[]) => void
        )

        // Return cleanup function
        return () => {
          unsubscribeFragment()
          unsubscribeComplete()
          unsubscribeError()
          unsubscribeMessage()
          unsubscribeToolCallStart()
          unsubscribeToolCallName()
          unsubscribeToolCallEnd()
          unsubscribeToolCallFinalized()
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
