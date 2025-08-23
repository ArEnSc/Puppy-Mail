import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import { logInfo, logError } from '@shared/logger'

export function useLMStudioAutoConnect(): void {
  const { lmStudio, validateLMStudio } = useSettingsStore()

  useEffect(() => {
    // Log current state for debugging
    logInfo('LM Studio auto-connect check', {
      url: lmStudio.url,
      model: lmStudio.model,
      isConnected: lmStudio.isConnected,
      isValidating: lmStudio.isValidating
    })

    // Auto-connect if we have a URL saved but not connected
    if (lmStudio.url && !lmStudio.isConnected && !lmStudio.isValidating) {
      logInfo('Auto-connecting to LM Studio', { url: lmStudio.url, model: lmStudio.model })

      validateLMStudio().catch((error) => {
        logError(error, 'LMSTUDIO_AUTO_CONNECT_ERROR')
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount
}
