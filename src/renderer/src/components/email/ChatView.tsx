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
  timestamp: Date
}

export function ChatView(): JSX.Element {
  const { selectedAutomatedTask } = useEmailStore()
  const { lmStudio } = useSettingsStore()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m ready to help you with your automated tasks. What would you like to configure?',
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
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

  useEffect(() => {
    if (!window.electron?.ipcRenderer) return

    const handleStreamChunk = (_event: any, chunk: string) => {
      if (streamingMessageId) {
        setMessages(prev => prev.map(msg => 
          msg.id === streamingMessageId 
            ? { ...msg, content: msg.content + chunk }
            : msg
        ))
      }
    }

    const handleStreamError = (_event: any, error: string) => {
      console.error('Stream error:', error)
      setIsStreaming(false)
      setStreamingMessageId(null)
      
      // Add error message
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${error}`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    }

    const handleStreamComplete = () => {
      setIsStreaming(false)
      setStreamingMessageId(null)
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
  }, [streamingMessageId])

  const handleSend = async () => {
    if (inputValue.trim() && !isStreaming) {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: inputValue.trim(),
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, userMessage])
      setInputValue('')

      // Check if LM Studio is connected
      if (!lmStudio.isConnected || !lmStudio.model) {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Please connect to LM Studio in the settings first.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
        return
      }

      // Create assistant message placeholder
      const assistantMessageId = (Date.now() + 2).toString()
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])
      setStreamingMessageId(assistantMessageId)
      setIsStreaming(true)

      // Start streaming
      if (window.electron?.ipcRenderer) {
        const conversationMessages = messages
          .concat(userMessage)
          .map(msg => ({
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
          <p className="text-xs text-muted-foreground mt-1">
            Connected to {lmStudio.model}
          </p>
        )}
      </div>

      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">
                  {message.content}
                  {isStreaming && message.id === streamingMessageId && (
                    <span className="inline-block ml-1 animate-pulse">▋</span>
                  )}
                </p>
                <p className="mt-1 text-xs opacity-70">
                  {message.timestamp.toLocaleTimeString()}
                </p>
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