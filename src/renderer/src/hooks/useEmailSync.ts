import { useEffect, useCallback } from 'react'
import { useEmailStore } from '@/store/emailStore'

export function useEmailSync(): { syncEmails: () => Promise<void> } {
  const { setEmails, setLoading, setError, setLastSyncTime } = useEmailStore()

  // Manual sync function
  const syncEmails = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (window.electron?.ipcRenderer) {
        const result = await window.electron.ipcRenderer.invoke('email:sync')
        if (result.success && result.timestamp) {
          setLastSyncTime(new Date(result.timestamp))
          // Fetch updated emails from database
          const emails = await window.electron.ipcRenderer.invoke('email:fetch')
          setEmails(emails)
        }
      }
    } catch (error) {
      console.error('Failed to sync emails:', error)
      setError(error instanceof Error ? error.message : 'Failed to sync emails')
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
        if (window.electron?.ipcRenderer) {
          const emails = await window.electron.ipcRenderer.invoke('email:fetch')
          setEmails(emails)
        } else {
          // Development fallback
          console.log('Email sync not available in development mode')
        }
      } catch (error) {
        console.error('Failed to fetch emails:', error)
        setError(error instanceof Error ? error.message : 'Failed to fetch emails')
      } finally {
        setLoading(false)
      }
    }

    fetchEmails()

    // Listen for new emails
    const handleNewEmails = (_event: unknown, emails: unknown[]): void => {
      setEmails(emails)
    }

    // Listen for sync complete events
    const handleSyncComplete = (
      _event: unknown,
      data: { timestamp: string; count: number }
    ): void => {
      setLastSyncTime(new Date(data.timestamp))
    }

    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on('email:newEmails', handleNewEmails)
      window.electron.ipcRenderer.on('email:syncComplete', handleSyncComplete)

      // Start polling
      window.electron.ipcRenderer.invoke('email:startPolling').catch(console.error)
    }

    // Cleanup
    return () => {
      if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.removeListener('email:newEmails', handleNewEmails)
        window.electron.ipcRenderer.removeListener('email:syncComplete', handleSyncComplete)
        window.electron.ipcRenderer.invoke('email:stopPolling').catch(console.error)
      }
    }
  }, [setEmails, setLoading, setError, setLastSyncTime])

  return { syncEmails }
}
