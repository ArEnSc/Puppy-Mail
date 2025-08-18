import React from 'react'
import { EmailLayout } from './components/email/EmailLayout'
import { Settings } from './components/Settings'
import { useEmailSync } from './hooks/useEmailSync'
import { useLMStudioAutoConnect } from './hooks/useLMStudioAutoConnect'

function App(): React.JSX.Element {
  // Sync emails with Gmail
  useEmailSync()

  // Auto-connect to LM Studio if previously configured
  useLMStudioAutoConnect()

  return (
    <>
      <EmailLayout />
      <Settings />
    </>
  )
}

export default App
