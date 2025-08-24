import React, { useEffect } from 'react'
import { EmailLayout } from './components/email/EmailLayout'
import { Settings } from './components/Settings'
import { useEmailSync } from './hooks/useEmailSync'
import { useLMStudioStore } from './store/lmStudioStore'
import { logError, logInfo } from '@shared/logger'

function App(): React.JSX.Element {
  // Sync emails with Gmail
  useEmailSync()

  // Auto-connect to LM Studio using the new store
  const { url, isConnected, isValidating, isAutoConnecting, connect, setAutoConnecting } =
    useLMStudioStore()

  useEffect(() => {
    // Clear any stale auto-connecting state on mount
    if (isAutoConnecting) {
      logInfo('Clearing stale auto-connecting state')
      setAutoConnecting(false)
    }

    // Auto-connect if we have a URL saved but not connected
    if (url && !isConnected && !isValidating && !isAutoConnecting) {
      logInfo('Auto-connecting to LM Studio', { url })

      setAutoConnecting(true)

      connect()
        .then(() => {
          logInfo('Auto-connect successful')
          setAutoConnecting(false)
        })
        .catch((error) => {
          logError('Auto-connect failed:', error)
          setAutoConnecting(false)
        })
    }
  }, [url, isConnected, isValidating, isAutoConnecting, connect, setAutoConnecting])

  return (
    <>
      <EmailLayout />
      <Settings />
    </>
  )
}

export default App
