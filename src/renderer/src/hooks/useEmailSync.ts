import { useEffect, useCallback } from 'react'
import { useEmailStore } from '@/store/emailStore'
import { ipc } from '@/lib/ipc'
import { EMAIL_IPC_CHANNELS } from '@shared/types/email'
import { ERROR_MESSAGES } from '@/shared/constants'
import { logError, logInfo } from '@shared/logger'
import type { Email } from '@shared/types/email'

export function useEmailSync(): { syncEmails: () => Promise<void> } {
  const { setEmails, setLoading, setError, setLastSyncTime } = useEmailStore()

  // Manual sync function
  const syncEmails = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await ipc.invoke<{ success: boolean; timestamp: string }>(
        EMAIL_IPC_CHANNELS.EMAIL_SYNC
      )

      if (result.success && result.timestamp) {
        setLastSyncTime(new Date(result.timestamp))
        // Fetch updated emails from database
        const emails = await ipc.invoke<Email[]>(EMAIL_IPC_CHANNELS.EMAIL_FETCH)
        setEmails(emails)
      }
    } catch (error) {
      logError(error as Error, 'EMAIL_SYNC_ERROR')
      setError(error instanceof Error ? error.message : ERROR_MESSAGES.EMAIL_SYNC_FAILED)
    } finally {
      setLoading(false)
    }
  }, [setEmails, setLoading, setError, setLastSyncTime])

  useEffect(() => {
    // Fetch emails on mount
    const fetchEmails = async (): Promise<void> => {
      setLoading(true)
      setError(null)

      try {
        if (ipc.isAvailable()) {
          const emails = await ipc.invoke<Email[]>(EMAIL_IPC_CHANNELS.EMAIL_FETCH)
          setEmails(emails)
        } else {
          // Development fallback
          logInfo('Email sync not available in development mode')
        }
      } catch (error) {
        logError(error as Error, 'EMAIL_FETCH_ERROR')
        setError(error instanceof Error ? error.message : ERROR_MESSAGES.EMAIL_FETCH_FAILED)
      } finally {
        setLoading(false)
      }
    }

    fetchEmails()

    // Listen for new emails
    const handleNewEmails = (_event: unknown, emails: Email[]): void => {
      setEmails(emails)
    }

    // Listen for sync complete events
    const handleSyncComplete = async (
      _event: unknown,
      data: { timestamp: string; count: number }
    ): Promise<void> => {
      setLastSyncTime(new Date(data.timestamp))
      // Fetch updated emails from database after sync completes
      try {
        const emails = await ipc.invoke<Email[]>(EMAIL_IPC_CHANNELS.EMAIL_FETCH)
        setEmails(emails)
      } catch (error) {
        logError(error as Error, 'EMAIL_FETCH_AFTER_SYNC_ERROR')
      }
    }

    // Set up event listeners
    const unsubscribeNewEmails = ipc.on(
      EMAIL_IPC_CHANNELS.EMAIL_NEW_EMAILS,
      handleNewEmails as (...args: unknown[]) => void
    )
    const unsubscribeSyncComplete = ipc.on(
      EMAIL_IPC_CHANNELS.EMAIL_SYNC_COMPLETE,
      handleSyncComplete as (...args: unknown[]) => void
    )

    // Start polling
    ipc.invoke(EMAIL_IPC_CHANNELS.EMAIL_START_POLLING).catch((error) => {
      logError(error, 'EMAIL_POLLING_START_ERROR')
    })

    // Cleanup
    return () => {
      unsubscribeNewEmails()
      unsubscribeSyncComplete()
      ipc.invoke(EMAIL_IPC_CHANNELS.EMAIL_STOP_POLLING).catch((error) => {
        logError(error, 'EMAIL_POLLING_STOP_ERROR')
      })
    }
  }, [setEmails, setLoading, setError, setLastSyncTime])

  return { syncEmails }
}
