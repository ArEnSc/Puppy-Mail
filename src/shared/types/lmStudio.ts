/**
 * Shared types for LM Studio IPC communication
 */

// IPC Response types
export interface LMStudioResponse<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

export interface LMStudioConnectResponse {
  models: string[]
}

export interface LMStudioModelsResponse {
  models: string[]
}

export interface LMStudioChatSessionResponse {
  sessionId: string
}

export interface LMStudioChatHistoryResponse {
  messages: LMStudioMessage[]
}

// Message types
export interface LMStudioMessage {
  role: string
  content: string
  toolCallRequests?: unknown[]
  toolCallResults?: unknown[]
}

// Event payload types
export interface LMStudioRoundStartPayload {
  roundIndex: number
}

export interface LMStudioRoundEndPayload {
  roundIndex: number
}

export interface LMStudioMessagePayload {
  role: string
  content: string
  toolCallRequests?: unknown[]
  toolCallResults?: unknown[]
}

export interface LMStudioFragmentPayload {
  content: string
  tokenCount?: number
  reasoningType?: 'none' | 'reasoning' | 'reasoningStartTag' | 'reasoningEndTag'
  isStructural?: boolean
}

export interface LMStudioErrorPayload {
  error: string
}

export interface LMStudioCompletePayload {
  sessionId: string
}

export interface LMStudioToolCallStartPayload {
  roundIndex: number
  callId: number
  toolCallId: string | undefined
}

export interface LMStudioToolCallNamePayload {
  roundIndex: number
  callId: number
  name: string
}

// Tool call request structure from LM Studio SDK
export interface LMStudioToolCallRequest {
  name: string
  arguments: Record<string, unknown>
}

export interface LMStudioToolCallEndPayload {
  roundIndex: number
  callId: number
  toolCall: LMStudioToolCallRequest
  rawContent: string | undefined
}

export interface LMStudioToolCallFinalizedPayload {
  roundIndex: number
  callId: number
  toolCall: LMStudioToolCallRequest
  rawContent: string | undefined
}

// IPC Channel names
export const LMSTUDIO_IPC_CHANNELS = {
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

export type LMStudioIPCChannel = (typeof LMSTUDIO_IPC_CHANNELS)[keyof typeof LMSTUDIO_IPC_CHANNELS]
