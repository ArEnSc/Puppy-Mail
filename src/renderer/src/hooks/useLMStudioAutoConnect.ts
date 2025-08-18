import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import { logInfo, logError } from '@/shared/errorHandler'

export function useLMStudioAutoConnect(): void {
  const { lmStudio, validateLMStudio } = useSettingsStore()

  useEffect(() => {
    // Auto-connect if we have a URL and model saved but not connected
    if (lmStudio.url && lmStudio.model && !lmStudio.isConnected && !lmStudio.isValidating) {
      logInfo('Auto-connecting to LM Studio', { url: lmStudio.url, model: lmStudio.model })

      validateLMStudio().catch((error) => {
        logError(error, 'LMSTUDIO_AUTO_CONNECT_ERROR')
      })
    }
  }, []) // Only run on mount
}
