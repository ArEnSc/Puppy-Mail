import { useState, useRef, useEffect } from 'react'
import { useEmailStore } from '@/store/emailStore'
import { useSettingsStore } from '@/store/settingsStore'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Loader2 } from 'lucide-react'

interface Message {
  id: string
  role: 'assistant' | 'user'
  content: string
  reasoning?: string
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
      _event: any,
      data: { chunk: string; type: 'content' | 'reasoning' }
    ) => {
      console.log('Received stream chunk:', data)
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

    const handleStreamError = (_event: any, error: string) => {
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

    const handleStreamComplete = () => {
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
    }
  }, []) // Empty dependency array - set up listeners only once

  const handleSend = async () => {
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
          conversationMessages
        )
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
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
            <div key={message.id} className="space-y-2">
              {/* Reasoning cell - only show for assistant messages */}
              {message.role === 'assistant' && message.reasoning !== undefined && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted/50 border border-border">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Reasoning</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                      {message.reasoning ||
                        (isStreaming && message.id === streamingMessageId ? 'Thinking...' : '')}
                      {isStreaming && message.id === streamingMessageId && message.reasoning && (
                        <span className="inline-block ml-1 animate-pulse">▋</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Main message cell */}
              <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content ||
                      (isStreaming && message.id === streamingMessageId && !message.reasoning
                        ? 'Thinking...'
                        : '')}
                    {isStreaming && message.id === streamingMessageId && message.content && (
                      <span className="inline-block ml-1 animate-pulse">▋</span>
                    )}
                  </p>
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
