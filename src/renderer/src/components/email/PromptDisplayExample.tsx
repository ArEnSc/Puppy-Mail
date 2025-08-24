import React from 'react'
import { PromptDisplay } from './PromptDisplay'

// Example usage of PromptDisplay component
export function PromptDisplayExample(): React.JSX.Element {
  const examplePrompt = `You are an AI assistant helping with email management tasks.
Your goal is to help users organize, prioritize, and respond to their emails efficiently.
You should be professional, concise, and helpful in your responses.`

  const exampleMessages = [
    {
      role: 'system' as const,
      content: 'System initialized. Ready to assist with email management.',
      timestamp: new Date('2025-08-19T10:00:00')
    },
    {
      role: 'user' as const,
      content: 'Can you help me organize my inbox by priority?',
      timestamp: new Date('2025-08-19T10:01:00')
    },
    {
      role: 'assistant' as const,
      content:
        "I'll help you organize your inbox by priority. Let me analyze your emails and categorize them based on urgency and importance.",
      timestamp: new Date('2025-08-19T10:01:15')
    },
    {
      role: 'error' as const,
      content: 'Failed to connect to email server. Please check your connection settings.',
      timestamp: new Date('2025-08-19T10:02:00')
    }
  ]

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Prompt & Message History</h2>
      <PromptDisplay prompt={examplePrompt} messages={exampleMessages} className="max-w-3xl" />
    </div>
  )
}
