import { useState, useRef, useEffect, JSX } from 'react'
import { useEmailStore } from '@/store/emailStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useLMStudio } from '@/hooks/useLMStudio'
import { ipc, IPC_CHANNELS } from '@/lib/ipc'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'

import {
  Send,
  Loader2,
  ChevronDown,
  ChevronRight,
  Code,
  Zap,
  AlertCircle,
  MessageSquare
} from 'lucide-react'
import { FlickeringGrid } from '@/components/ui/flickering-grid'
import { AnimatedShinyText } from '@/components/magicui/animated-shiny-text'
import { formatFunctionsForPrompt } from '@/lib/functionDefinitions'

interface FunctionCall {
  name: string
  arguments: Record<string, unknown>
  result?: unknown
  error?: string
}

interface Message {
  prompt?: string
  contextMessages?: Array<{ role: string; content: string }>
  id: string
  role: 'system' | 'assistant' | 'user' | 'error'
  content: string
  reasoning?: string
  functionCalls?: FunctionCall[]
  timestamp: Date
}

export function ChatView(): JSX.Element {
  const { selectedAutomatedTask } = useEmailStore()
  const { lmStudio } = useSettingsStore()
  const prompt =
    'You are Chloe a Sassy, Boston Terrier and AI assistant helping users with email automation tasks. Be helpful, concise.'

  // Use SDK for sending messages
  const { sendMessage: sendSDKMessage } = useLMStudio(prompt)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      content:
        "Hello! I'm ready to help you with your automated tasks. What would you like to configure?",
      timestamp: new Date(),
      prompt: prompt,
      contextMessages: [
        {
          role: 'system',
          content: prompt
        }
      ]
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [expandedReasonings, setExpandedReasonings] = useState<Set<string>>(new Set())
  const [expandedFunctionCalls, setExpandedFunctionCalls] = useState<Set<string>>(new Set())
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set())
  const [enableFunctions, setEnableFunctions] = useState(true)
  const [sessionId] = useState(() => `chat-${Date.now()}`)
  const [chatInitialized, setChatInitialized] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isMountedRef = useRef(false)

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      )
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages])

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [inputValue])

  // Use a ref to store the current streaming message ID to avoid closure issues
  const streamingMessageIdRef = useRef<string | null>(null)

  useEffect(() => {
    streamingMessageIdRef.current = streamingMessageId
  }, [streamingMessageId])

  // Initialize chat session when component mounts
  useEffect(() => {
    const initializeChat = async (): Promise<void> => {
      if (lmStudio.isConnected && !chatInitialized) {
        try {
          await ipc.invoke(IPC_CHANNELS.LMSTUDIO_GET_OR_CREATE_CHAT, sessionId, prompt)
          setChatInitialized(true)
        } catch (error) {
          console.error('Failed to initialize chat:', error)
        }
      }
    }

    initializeChat()
  }, [lmStudio.isConnected, sessionId, prompt, chatInitialized])

  useEffect(() => {
    // Track mounting
    isMountedRef.current = true

    if (!ipc.isAvailable()) return

    const handleStreamChunk = (
      ...[, data]: [unknown, { chunk: string; type: 'content' | 'reasoning' }]
    ): void => {
      if (streamingMessageIdRef.current && isMountedRef.current) {
        const currentId = streamingMessageIdRef.current
        const { chunk, type } = data

        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === currentId) {
              if (type === 'reasoning') {
                return { ...msg, reasoning: (msg.reasoning || '') + chunk }
              } else {
                return { ...msg, content: msg.content + chunk }
              }
            }
            return msg
          })
        )
      }
    }

    const handleStreamError = (...[, error]: [unknown, string]): void => {
      console.error('Stream error:', error)
      setIsStreaming(false)
      setStreamingMessageId(null)
      streamingMessageIdRef.current = null

      // Add error as a message in the chat
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'error',
        content: error,
        timestamp: new Date(),
        prompt: undefined,
        contextMessages: undefined
      }
      setMessages((prev) => [...prev, errorMessage])
    }

    const handleStreamComplete = (): void => {
      setIsStreaming(false)
      setStreamingMessageId(null)
      streamingMessageIdRef.current = null
    }

    const handleFunctionCall = (
      ...[, functionCall]: [unknown, FunctionCall & { result?: unknown }]
    ): void => {
      if (streamingMessageIdRef.current && isMountedRef.current) {
        const currentId = streamingMessageIdRef.current

        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === currentId) {
              const existingCalls = msg.functionCalls || []
              return {
                ...msg,
                functionCalls: [...existingCalls, functionCall]
              }
            }
            return msg
          })
        )
      }
    }

    // Add listeners
    const unsubscribeChunk = ipc.on(IPC_CHANNELS.LMSTUDIO_STREAM_CHUNK, handleStreamChunk)
    const unsubscribeError = ipc.on(IPC_CHANNELS.LMSTUDIO_STREAM_ERROR, handleStreamError)
    const unsubscribeComplete = ipc.on(IPC_CHANNELS.LMSTUDIO_STREAM_COMPLETE, handleStreamComplete)
    const unsubscribeFunctionCall = ipc.on(
      IPC_CHANNELS.LMSTUDIO_STREAM_FUNCTION_CALL,
      handleFunctionCall
    )

    // Cleanup
    return () => {
      unsubscribeChunk()
      unsubscribeError()
      unsubscribeComplete()
      unsubscribeFunctionCall()
      isMountedRef.current = false
    }
  }, []) // Empty dependency array - set up listeners only once

  const handleSend = async (): Promise<void> => {
    if (inputValue.trim() && !isStreaming) {
      // Clear any existing streaming state
      setStreamingMessageId(null)

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: inputValue.trim(),
        timestamp: new Date()
      }

      setMessages((prev) => [...prev, userMessage])
      setInputValue('')

      // Check if LM Studio is connected
      if (!lmStudio.isConnected || !lmStudio.model) {
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Please connect to LM Studio in the settings first.',
          timestamp: new Date()
        }
        setMessages((prev) => [...prev, errorMessage])
        return
      }

      // Start streaming
      if (ipc.isAvailable()) {
        const conversationMessages = messages.concat(userMessage).map((msg) => ({
          role: msg.role,
          content: msg.content
        }))

        // Build the system prompt that will be sent
        let systemPrompt = prompt
        const systemMessage = conversationMessages.find((msg) => msg.role === 'system')
        if (systemMessage) {
          systemPrompt = systemMessage.content
        }

        // Add function definitions if enabled
        if (enableFunctions) {
          const functionsPrompt = formatFunctionsForPrompt()
          systemPrompt += '\n\n' + functionsPrompt
        }

        // Create assistant message placeholder with prompt info
        const assistantMessageId = crypto.randomUUID()
        const assistantMessage: Message = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          reasoning: '',
          timestamp: new Date(),
          prompt: systemPrompt,
          contextMessages: conversationMessages
        }
        setMessages((prev) => [...prev, assistantMessage])
        setStreamingMessageId(assistantMessageId)
        streamingMessageIdRef.current = assistantMessageId
        setIsStreaming(true)

        // Use SDK to send message
        await sendSDKMessage(userMessage.content, enableFunctions)
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleReasoning = (messageId: string): void => {
    setExpandedReasonings((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  const toggleFunctionCalls = (messageId: string): void => {
    setExpandedFunctionCalls((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  const togglePrompt = (messageId: string): void => {
    setExpandedPrompts((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  return (
    <div className="relative flex h-full flex-col">
      <FlickeringGrid
        className="absolute inset-0 z-0"
        squareSize={5}
        gridGap={6}
        color="rgb(64, 64, 64)"
        maxOpacity={0.15}
        flickerChance={0.1}
      />
      <div className="relative z-10 border-b border-border p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <h2 className="text-lg font-semibold">
          {selectedAutomatedTask === 'daily-summary' && 'Daily Summary Configuration'}
          {selectedAutomatedTask === 'email-cleanup' && 'Email Cleanup Configuration'}
          {!selectedAutomatedTask && 'Task Assistant'}
        </h2>
        {lmStudio.isConnected && (
          <p className="text-xs text-muted-foreground mt-1">Connected to {lmStudio.model}</p>
        )}
      </div>

      <ScrollArea ref={scrollAreaRef} className="relative z-10 flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id}>
              <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : message.role === 'error'
                        ? 'bg-destructive/10 text-destructive border border-destructive/20'
                        : 'bg-muted'
                  }`}
                >
                  {/* Error icon for error messages */}
                  {message.role === 'error' && (
                    <div className="flex items-start gap-2 mb-2">
                      <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                      <span className="font-semibold text-sm">LM Studio Error</span>
                    </div>
                  )}

                  {/* Message content */}
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content ||
                      (isStreaming && message.id === streamingMessageId && !message.reasoning ? (
                        <AnimatedShinyText className="text-sm">Thinking...</AnimatedShinyText>
                      ) : (
                        ''
                      ))}
                    {isStreaming && message.id === streamingMessageId && message.content && (
                      <span className="inline-block ml-1 animate-pulse">▋</span>
                    )}
                  </p>

                  {/* Reasoning section - collapsible, only for assistant messages */}
                  {message.role === 'assistant' &&
                    message.reasoning !== undefined &&
                    message.reasoning && (
                      <div className="mt-2 border-t border-border/50 pt-2">
                        <button
                          onClick={() => toggleReasoning(message.id)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {expandedReasonings.has(message.id) ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          <span className="font-medium">Reasoning</span>
                        </button>

                        {expandedReasonings.has(message.id) && (
                          <div className="mt-2 pl-4">
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                              {message.reasoning}
                              {isStreaming && message.id === streamingMessageId && (
                                <span className="inline-block ml-1 animate-pulse">▋</span>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                  {/* Function calls section - collapsible, only for assistant messages */}
                  {message.role === 'assistant' &&
                    message.functionCalls &&
                    message.functionCalls.length > 0 && (
                      <div className="mt-2 border-t border-border/50 pt-2">
                        <button
                          onClick={() => toggleFunctionCalls(message.id)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {expandedFunctionCalls.has(message.id) ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          <Zap className="h-3 w-3" />
                          <span className="font-medium">
                            Function Calls ({message.functionCalls.length})
                          </span>
                        </button>

                        {expandedFunctionCalls.has(message.id) && (
                          <div className="mt-2 space-y-2">
                            {message.functionCalls.map((call, index) => (
                              <div
                                key={index}
                                className="pl-4 text-xs font-mono bg-muted/50 rounded p-2"
                              >
                                <div className="font-semibold text-primary mb-1">
                                  {call.name}({JSON.stringify(call.arguments, null, 2)})
                                </div>
                                {call.result !== undefined && (
                                  <div className="mt-1">
                                    <span className="text-green-600 dark:text-green-400">→ </span>
                                    <span className="text-muted-foreground">
                                      {JSON.stringify(call.result, null, 2)}
                                    </span>
                                  </div>
                                )}
                                {call.error && (
                                  <div className="mt-1">
                                    <span className="text-red-600 dark:text-red-400">✗ </span>
                                    <span className="text-red-600 dark:text-red-400">
                                      {call.error}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                  {/* Prompt and Context section - collapsible, only for assistant messages */}
                  {message.role === 'assistant' && message.prompt && message.contextMessages && (
                    <div className="mt-2 border-t border-border/50 pt-2">
                      <button
                        onClick={() => togglePrompt(message.id)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {expandedPrompts.has(message.id) ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        <MessageSquare className="h-3 w-3" />
                        <span className="font-medium">Prompt & Context</span>
                      </button>

                      {expandedPrompts.has(message.id) && (
                        <div className="mt-2 space-y-2">
                          <div className="pl-4">
                            <div className="text-xs font-medium text-muted-foreground mb-1">
                              System Prompt:
                            </div>
                            <div className="text-xs bg-muted/50 rounded p-2 whitespace-pre-wrap break-words">
                              {message.prompt}
                            </div>
                          </div>
                          <div className="pl-4">
                            <div className="text-xs font-medium text-muted-foreground mb-1">
                              Context Messages ({message.contextMessages.length}):
                            </div>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {message.contextMessages.map((msg, idx) => (
                                <div
                                  key={idx}
                                  className={`text-xs rounded p-2 ${
                                    msg.role === 'user'
                                      ? 'bg-primary/10'
                                      : msg.role === 'assistant'
                                        ? 'bg-muted/50'
                                        : 'bg-secondary/50'
                                  }`}
                                >
                                  <div className="font-medium capitalize mb-1">{msg.role}:</div>
                                  <div className="whitespace-pre-wrap break-words">
                                    {msg.content.length > 200
                                      ? msg.content.substring(0, 200) + '...'
                                      : msg.content}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show reasoning indicator while streaming but no content yet */}
                  {message.role === 'assistant' &&
                    isStreaming &&
                    message.id === streamingMessageId &&
                    !message.content &&
                    message.reasoning && (
                      <div className="mt-2 text-xs text-muted-foreground italic">
                        Processing reasoning...
                      </div>
                    )}

                  <p className="mt-1 text-xs opacity-70">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="relative z-10 border-t border-border p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEnableFunctions(!enableFunctions)}
            className={`flex items-center gap-2 ${enableFunctions ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <Code className="h-4 w-4" />
            <span>Function Calling {enableFunctions ? 'ON' : 'OFF'}</span>
          </Button>
          {enableFunctions && (
            <span className="text-xs text-muted-foreground">
              Try: &quot;What&apos;s 5 + 7?&quot; or &quot;What time is it?&quot;
            </span>
          )}
        </div>

        {/* Temporary error test button */}
        {/* <Button
          onClick={() => {
            const mockError: Message = {
              id: crypto.randomUUID(),
              role: 'error',
              content:
                'The number of tokens to keep from the initial prompt is greater than the context length. Try to load the model with a larger context length, or provide a shorter input.',
              timestamp: new Date()
            }
            setMessages((prev) => [...prev, mockError])
          }}
          className="mb-2 w-full"
          variant="destructive"
        >
          Test Error Message
        </Button> */}

        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 min-h-[44px] max-h-[200px] resize-none"
            disabled={isStreaming}
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isStreaming}
            className="self-end"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
