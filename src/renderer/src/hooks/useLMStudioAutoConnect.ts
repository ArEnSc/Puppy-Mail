import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settingsStore'

export function useLMStudioAutoConnect(): void {
  const { lmStudio, validateLMStudio } = useSettingsStore()

  useEffect(() => {
    // Auto-connect if we have a URL and model saved but not connected
    if (lmStudio.url && lmStudio.model && !lmStudio.isConnected && !lmStudio.isValidating) {
      console.log('Auto-connecting to LM Studio at:', lmStudio.url)
      validateLMStudio().catch((error) => {
        console.error('Failed to auto-connect to LM Studio:', error)
      })
    }
  }, []) // Only run on mount
}
