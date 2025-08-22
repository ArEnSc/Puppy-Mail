import { useState, useEffect, useCallback } from 'react'
import { useSettingsStore } from '@/store/settingsStore'

import { ipc } from '@/lib/ipc'
import { LMSTUDIO_IPC_CHANNELS } from '../../../shared/types/lmStudio'
import type {
  LMStudioResponse,
  LMStudioChatSessionResponse,
  LMStudioFragmentPayload,
  LMStudioErrorPayload
} from '../../../shared/types/lmStudio'

interface ToolCall {
  name: string
  arguments?: Record<string, unknown>
}

interface UseLMStudioCallbacks {
  onFragment?: (content: string) => void
  onError?: (error: string) => void
  onComplete?: () => void
  onToolCall?: (toolCall: ToolCall) => void
}

export function useLMStudio(
  systemPrompt?: string,
  callbacks?: UseLMStudioCallbacks
): {
  isConnected: boolean
  isStreaming: boolean
  sessionId: string
  initializeChat: (
    customSystemPrompt?: string
  ) => Promise<LMStudioResponse<LMStudioChatSessionResponse> | undefined>
  sendMessage: (message: string, enableTools?: boolean) => Promise<void>
} {
  const { lmStudio } = useSettingsStore()
  const [sessionId] = useState(() => `chat-${Date.now()}`)
  const [isStreaming, setIsStreaming] = useState(false)

  // Initialize chat session
  const initializeChat = useCallback(
    async (
      customSystemPrompt?: string
    ): Promise<LMStudioResponse<LMStudioChatSessionResponse> | undefined> => {
      if (!lmStudio.isConnected) {
        console.log('Not connected to LM Studio')
        return
      }

      try {
        const prompt = customSystemPrompt || systemPrompt
        const result = await ipc.invoke<LMStudioResponse<LMStudioChatSessionResponse>>(
          LMSTUDIO_IPC_CHANNELS.LMSTUDIO_GET_OR_CREATE_CHAT,
          sessionId,
          prompt
        )

        console.log('Chat initialized:', result)
        return result
      } catch (error) {
        console.error('Error initializing chat:', error)
        return undefined
      }
    },
    [lmStudio.isConnected, sessionId, systemPrompt]
  )

  // Send message
  const sendMessage = useCallback(
    async (message: string, enableTools = true): Promise<void> => {
      if (!lmStudio.isConnected || !lmStudio.model || isStreaming) {
        console.log('Cannot send message:', {
          connected: lmStudio.isConnected,
          model: lmStudio.model,
          streaming: isStreaming
        })
        return
      }

      setIsStreaming(true)

      // Send via IPC
      ipc.send(LMSTUDIO_IPC_CHANNELS.LMSTUDIO_CHAT, sessionId, lmStudio.model, message, enableTools)
    },
    [lmStudio.isConnected, lmStudio.model, isStreaming, sessionId]
  )

  // Set up event listeners
  useEffect(() => {
    if (!ipc.isAvailable()) return

    // Fragment handler - stream to callback
    const handleFragment = (_event: unknown, data: LMStudioFragmentPayload): void => {
      callbacks?.onFragment?.(data.content)
    }

    const handleComplete = (): void => {
      setIsStreaming(false)
      callbacks?.onComplete?.()
    }

    const handleError = (_event: unknown, data: LMStudioErrorPayload): void => {
      console.error('LM Studio error:', data.error)
      setIsStreaming(false)
      callbacks?.onError?.(data.error)
    }

    // Tool call handler
    const handleToolCallEnd = (_event: unknown, data: { toolCall?: ToolCall }): void => {
      if (data.toolCall) {
        callbacks?.onToolCall?.(data.toolCall)
      }
    }

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

    return () => {
      unsubscribeFragment()
      unsubscribeComplete()
      unsubscribeError()
      unsubscribeToolCall()
    }
  }, [callbacks])

  // Auto-initialize on mount if connected
  useEffect(() => {
    if (lmStudio.isConnected) {
      initializeChat()
    }
  }, [lmStudio.isConnected, initializeChat])

  return {
    isConnected: lmStudio.isConnected,
    isStreaming,
    sessionId,
    initializeChat,
    sendMessage
  }
}
