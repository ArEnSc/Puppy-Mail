import { useState, useEffect, useCallback } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import { ipc, IPC_CHANNELS } from '@/lib/ipc'
import type {
  LMStudioResponse,
  LMStudioChatSessionResponse,
  LMStudioFragmentPayload,
  LMStudioErrorPayload
} from '../../../shared/types/lmStudio'

export function useLMStudio(systemPrompt?: string): {
  isConnected: boolean
  isStreaming: boolean
  sessionId: string
  streamingContent: string
  initializeChat: (
    customSystemPrompt?: string
  ) => Promise<LMStudioResponse<LMStudioChatSessionResponse> | undefined>
  sendMessage: (message: string, enableTools?: boolean) => Promise<void>
} {
  const { lmStudio } = useSettingsStore()
  const [sessionId] = useState(() => `chat-${Date.now()}`)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')

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
          IPC_CHANNELS.LMSTUDIO_GET_OR_CREATE_CHAT,
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
      setStreamingContent('')

      // Send via IPC
      ipc.send(IPC_CHANNELS.LMSTUDIO_CHAT, sessionId, lmStudio.model, message, enableTools)
    },
    [lmStudio.isConnected, lmStudio.model, isStreaming, sessionId]
  )

  // Set up event listeners
  useEffect(() => {
    if (!ipc.isAvailable()) return

    // Simple fragment handler for now
    const handleFragment = (_event: unknown, data: LMStudioFragmentPayload): void => {
      setStreamingContent((prev) => prev + data.content)
    }

    const handleComplete = (): void => {
      setIsStreaming(false)
    }

    const handleError = (_event: unknown, data: LMStudioErrorPayload): void => {
      console.error('LM Studio error:', data.error)
      setIsStreaming(false)
    }

    const unsubscribeFragment = ipc.on(
      IPC_CHANNELS.LMSTUDIO_FRAGMENT,
      handleFragment as (...args: unknown[]) => void
    )
    const unsubscribeComplete = ipc.on(
      IPC_CHANNELS.LMSTUDIO_COMPLETE,
      handleComplete as (...args: unknown[]) => void
    )
    const unsubscribeError = ipc.on(
      IPC_CHANNELS.LMSTUDIO_ERROR,
      handleError as (...args: unknown[]) => void
    )

    return () => {
      unsubscribeFragment()
      unsubscribeComplete()
      unsubscribeError()
    }
  }, [])

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
    streamingContent,
    initializeChat,
    sendMessage
  }
}
