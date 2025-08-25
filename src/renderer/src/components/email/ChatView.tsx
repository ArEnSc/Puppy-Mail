import { useState, useRef, useEffect, type JSX } from 'react'
import { useEmailStore } from '@/store/emailStore'
import { useLMStudioStore } from '@/store/lmStudioStore'
import { useAutoScroll, useAutoResizeTextarea } from '@/hooks/layoutHooks'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { logError } from '@shared/logger'

import {
  Send,
  Loader2,
  ChevronDown,
  ChevronRight,
  Code,
  Zap,
  AlertCircle,
  MessageSquare,
  Clock
} from 'lucide-react'
import { FlickeringGrid } from '@/components/ui/flickering-grid'
import { AnimatedShinyText } from '@/components/magicui/animated-shiny-text'

// Helper function to parse result and check for errors
function parseResult(result: unknown): { parsedResult: unknown; isError: boolean } {
  let parsedResult = result

  // Try to parse if it's a string
  if (typeof result === 'string') {
    try {
      parsedResult = JSON.parse(result)
    } catch {
      parsedResult = result
    }
  }

  // Check if it's an error
  const isError =
    parsedResult &&
    typeof parsedResult === 'object' &&
    parsedResult !== null &&
    (('success' in parsedResult && (parsedResult as { success?: boolean }).success === false) ||
      'error' in parsedResult)

  return { parsedResult, isError }
}

// Component for rendering function call results
function FunctionCallResult({ result }: { result: unknown }): JSX.Element {
  const { parsedResult, isError } = parseResult(result)

  return (
    <div
      className={`mt-2 p-2 rounded border ${
        isError
          ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
          : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
      }`}
    >
      <div
        className={`text-xs font-medium mb-1 ${
          isError ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'
        }`}
      >
        Result:
      </div>
      <div className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">
        {typeof parsedResult === 'object'
          ? JSON.stringify(parsedResult, null, 2)
          : String(parsedResult)}
      </div>
    </div>
  )
}

export function ChatView(): JSX.Element {
  const { selectedAutomatedTask } = useEmailStore()
  const {
    isConnected,
    isAutoConnecting,
    isValidating,
    model,
    sessions,
    activeSessionId,
    createSession,
    setActiveSession,
    sendMessage,
    initializeChat,
    registerEventHandlers
  } = useLMStudioStore()

  const systemPrompt =
    'You are Chloe, a sassy Boston Terrier and AI assistant helping users with email automation tasks. Be helpful, concise, and occasionally show your playful personality. When using tools/functions, interpret the results and provide a natural language response to the user. Never show raw JSON results or technical details like {"success":true,...} - instead, explain what happened in friendly terms.'

  // UI state
  const [inputValue, setInputValue] = useState('')
  const [expandedReasonings, setExpandedReasonings] = useState<Set<string>>(new Set())
  const [expandedFunctionCalls, setExpandedFunctionCalls] = useState<Set<string>>(new Set())
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set())
  const [enableFunctions, setEnableFunctions] = useState(true)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Get current session from store
  const currentSession = activeSessionId ? sessions[activeSessionId] : null
  const messages = currentSession?.messages || []
  const isStreaming = currentSession?.isStreaming || false
  const streamingMessageId = currentSession?.streamingMessageId || null

  // Initialize session on mount
  useEffect(() => {
    if (!activeSessionId) {
      const sessionId = createSession(systemPrompt)
      setActiveSession(sessionId)

      // Initialize chat and add welcome message
      initializeChat(sessionId, systemPrompt).then(() => {
        const store = useLMStudioStore.getState()
        store.addMessage(sessionId, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            "Woof! 🐾 I'm Chloe, your email automation assistant. I'm here to help you configure automated tasks. What would you like to set up today?",
          timestamp: new Date()
        })
      })

      // Register event handlers
      const cleanup = registerEventHandlers(sessionId, {
        onError: (error: string) => {
          logError('LM Studio chat error:', error)
        }
      })

      return cleanup
    }
    return
  }, [
    activeSessionId,
    createSession,
    setActiveSession,
    initializeChat,
    registerEventHandlers,
    systemPrompt
  ])

  // Auto-scroll to bottom when messages change
  useAutoScroll(scrollAreaRef, [messages])
  // Auto-resize textarea based on content
  useAutoResizeTextarea(textareaRef, inputValue)

  const handleSend = async (): Promise<void> => {
    if (!inputValue.trim() || isStreaming || !activeSessionId) return

    const content = inputValue.trim()
    setInputValue('')

    // Check connection status
    if (!isConnected || !model) {
      const store = useLMStudioStore.getState()
      store.addMessage(activeSessionId, {
        id: crypto.randomUUID(),
        role: 'error',
        content: 'Please connect to LM Studio in the settings first.',
        timestamp: new Date()
      })
      return
    }

    // Send message through store
    await sendMessage(activeSessionId, content, enableFunctions)
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

  const getTaskTitle = (): string => {
    switch (selectedAutomatedTask) {
      case 'daily-summary':
        return 'Daily Summary Configuration'
      case 'email-cleanup':
        return 'Email Cleanup Configuration'
      default:
        return 'Email Automation Assistant'
    }
  }

  const getConnectionStatus = (): JSX.Element | null => {
    if (isAutoConnecting || isValidating) {
      return (
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Connecting to LM Studio...
        </p>
      )
    }

    if (isConnected && model) {
      return (
        <p className="text-xs text-muted-foreground mt-1">Connected to {model.split('/').pop()}</p>
      )
    }

    return null
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
        <h2 className="text-lg font-semibold">{getTaskTitle()}</h2>
        {getConnectionStatus()}
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
                      <span className="font-semibold text-sm">Connection Error</span>
                    </div>
                  )}

                  {/* Message content */}
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {message.content ||
                      (isStreaming && message.id === streamingMessageId && !message.content ? (
                        <AnimatedShinyText className="text-sm">Thinking...</AnimatedShinyText>
                      ) : (
                        ''
                      ))}
                    {isStreaming && message.id === streamingMessageId && message.content && (
                      <span className="inline-block ml-1 animate-pulse">▋</span>
                    )}
                  </div>

                  {/* Reasoning section */}
                  {message.role === 'assistant' && message.reasoning && (
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
                          <div className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                            {message.reasoning}
                            {isStreaming && message.id === streamingMessageId && (
                              <span className="inline-block ml-1 animate-pulse">▋</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Function calls section */}
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
                                {call.isStreaming ? (
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Clock className="h-3 w-3 animate-pulse" />
                                    <span className="italic">
                                      {call.name === 'Loading...'
                                        ? 'Preparing function call...'
                                        : `Calling ${call.name}...`}
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="font-semibold text-primary mb-1">
                                      {call.name}
                                      {call.arguments && Object.keys(call.arguments).length > 0 && (
                                        <>({JSON.stringify(call.arguments, null, 2)})</>
                                      )}
                                    </div>
                                    {call.result !== undefined && (
                                      <FunctionCallResult result={call.result} />
                                    )}
                                    {call.error && (
                                      <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-800">
                                        <div className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">
                                          Error:
                                        </div>
                                        <div className="text-xs text-red-600 dark:text-red-400 font-mono">
                                          {call.error}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                  {/* Prompt and Context section */}
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
                        <span className="font-medium">Context</span>
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
                          {message.contextMessages.length > 0 && (
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
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-1 text-xs opacity-70">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
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
            <span>Functions {enableFunctions ? 'ON' : 'OFF'}</span>
          </Button>
          {enableFunctions && (
            <span className="text-xs text-muted-foreground">
              Try: &quot;What&apos;s the weather?&quot; or &quot;Calculate 15% tip on $85&quot;
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={
              isConnected ? 'Type your message...' : 'Connect to LM Studio to start chatting...'
            }
            className="flex-1 min-h-[44px] max-h-[200px] resize-none"
            disabled={isStreaming || !isConnected}
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isStreaming || !isConnected}
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
