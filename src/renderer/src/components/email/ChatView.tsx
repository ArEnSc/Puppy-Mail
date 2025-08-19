import { useState, useRef, useEffect } from 'react'
import { useEmailStore } from '@/store/emailStore'
import { useSettingsStore } from '@/store/settingsStore'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Loader2, ChevronDown, ChevronRight, Code, Zap } from 'lucide-react'

interface FunctionCall {
  name: string
  arguments: Record<string, unknown>
  result?: unknown
  error?: string
}

interface Message {
  id: string
  role: 'assistant' | 'user'
  content: string
  reasoning?: string
  functionCalls?: FunctionCall[]
  timestamp: Date
}

export function ChatView(): JSX.Element {
  const { selectedAutomatedTask } = useEmailStore()
  const { lmStudio } = useSettingsStore()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      content:
        "Hello! I'm ready to help you with your automated tasks. What would you like to configure?",
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [expandedReasonings, setExpandedReasonings] = useState<Set<string>>(new Set())
  const [expandedFunctionCalls, setExpandedFunctionCalls] = useState<Set<string>>(new Set())
  const [enableFunctions, setEnableFunctions] = useState(true)
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

  useEffect(() => {
    // Track mounting
    isMountedRef.current = true

    if (!window.electron?.ipcRenderer) return

    const handleStreamChunk = (
      ...[_event, data]: [unknown, { chunk: string; type: 'content' | 'reasoning' }]
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

    const handleStreamError = (...[_event, error]: [unknown, string]): void => {
      console.error('Stream error:', error)
      setIsStreaming(false)
      setStreamingMessageId(null)
      streamingMessageIdRef.current = null

      // Add error message
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${error}`,
        timestamp: new Date()
      }
      setMessages((prev) => [...prev, errorMessage])
    }

    const handleStreamComplete = (): void => {
      setIsStreaming(false)
      setStreamingMessageId(null)
      streamingMessageIdRef.current = null
    }

    // Add listeners
    window.electron.ipcRenderer.on('lmstudio:stream:chunk', handleStreamChunk)
    window.electron.ipcRenderer.on('lmstudio:stream:error', handleStreamError)
    window.electron.ipcRenderer.on('lmstudio:stream:complete', handleStreamComplete)

    // Cleanup
    return () => {
      window.electron.ipcRenderer.off('lmstudio:stream:chunk', handleStreamChunk)
      window.electron.ipcRenderer.off('lmstudio:stream:error', handleStreamError)
      window.electron.ipcRenderer.off('lmstudio:stream:complete', handleStreamComplete)
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

      // Create assistant message placeholder with unique ID
      const assistantMessageId = crypto.randomUUID()
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        reasoning: '',
        timestamp: new Date()
      }
      setMessages((prev) => [...prev, assistantMessage])
      setStreamingMessageId(assistantMessageId)
      streamingMessageIdRef.current = assistantMessageId
      setIsStreaming(true)

      // Start streaming
      if (window.electron?.ipcRenderer) {
        const conversationMessages = messages.concat(userMessage).map((msg) => ({
          role: msg.role,
          content: msg.content
        }))

        window.electron.ipcRenderer.send(
          'lmstudio:stream',
          lmStudio.url,
          lmStudio.model,
          conversationMessages,
          enableFunctions
        )
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

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold">
          {selectedAutomatedTask === 'daily-summary' && 'Daily Summary Configuration'}
          {selectedAutomatedTask === 'email-cleanup' && 'Email Cleanup Configuration'}
          {!selectedAutomatedTask && 'Task Assistant'}
        </h2>
        {lmStudio.isConnected && (
          <p className="text-xs text-muted-foreground mt-1">Connected to {lmStudio.model}</p>
        )}
      </div>

      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id}>
              <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                >
                  {/* Message content */}
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content ||
                      (isStreaming && message.id === streamingMessageId && !message.reasoning
                        ? 'Thinking...'
                        : '')}
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

      <div className="border-t border-border p-4">
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
