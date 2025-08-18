import React from 'react'
import { EmailLayout } from './components/email/EmailLayout'
import { Settings } from './components/Settings'
import { useEmailSync } from './hooks/useEmailSync'

function App(): React.JSX.Element {
  // Sync emails with Gmail
  useEmailSync()

  return (
    <>
      <EmailLayout />
      <Settings />
    </>
  )
}

export default App
