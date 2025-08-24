import React, { useState } from 'react'
import { ChevronDown, ChevronRight, MessageSquare, User, Bot, AlertCircle } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Message {
  role: 'system' | 'user' | 'assistant' | 'error'
  content: string
  timestamp?: Date
}

interface PromptDisplayProps {
  prompt: string
  messages: Message[]
  className?: string
}

export function PromptDisplay({
  prompt,
  messages,
  className = ''
}: PromptDisplayProps): React.JSX.Element {
  const [expandedPrompt, setExpandedPrompt] = useState(false)
  const [expandedMessages, setExpandedMessages] = useState(false)

  const togglePrompt = (): void => {
    setExpandedPrompt((prev) => !prev)
  }

  const toggleMessages = (): void => {
    setExpandedMessages((prev) => !prev)
  }

  const getRoleIcon = (role: string): React.JSX.Element => {
    switch (role) {
      case 'user':
        return <User className="h-4 w-4" />
      case 'assistant':
        return <Bot className="h-4 w-4" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  const getRoleStyles = (role: string): string => {
    switch (role) {
      case 'user':
        return 'bg-primary/10 border-primary/20'
      case 'assistant':
        return 'bg-muted border-muted-foreground/20'
      case 'error':
        return 'bg-destructive/10 border-destructive/20'
      case 'system':
        return 'bg-secondary/50 border-secondary'
      default:
        return 'bg-muted'
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Current Prompt Section */}
      <div className="rounded-lg border border-border bg-card p-4">
        <button
          onClick={togglePrompt}
          className="flex w-full items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
        >
          {expandedPrompt ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <MessageSquare className="h-4 w-4" />
          <span>Current Prompt</span>
        </button>

        {expandedPrompt && (
          <div className="mt-3 rounded-md bg-muted/50 p-3">
            <pre className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
              {prompt}
            </pre>
          </div>
        )}
      </div>

      {/* Messages History Section */}
      {messages.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <button
            onClick={toggleMessages}
            className="flex w-full items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
          >
            {expandedMessages ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <MessageSquare className="h-4 w-4" />
            <span>Message History ({messages.length})</span>
          </button>

          {expandedMessages && (
            <ScrollArea className="mt-3 max-h-[400px]">
              <div className="space-y-3 pr-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`rounded-lg border p-3 ${getRoleStyles(message.role)}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {getRoleIcon(message.role)}
                      <span className="text-xs font-medium capitalize">{message.role}</span>
                      {message.timestamp && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  )
}
