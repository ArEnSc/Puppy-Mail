import { useEffect } from 'react'
import { useEmailStore } from '@/store/emailStore'

export function useEmailSync() {
  const { setEmails, setLoading, setError } = useEmailStore()

  useEffect(() => {
    // Fetch emails on mount
    const fetchEmails = async () => {
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
    const handleNewEmails = (_event: any, emails: any[]) => {
      setEmails(emails)
    }

    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on('email:newEmails', handleNewEmails)
      
      // Start polling
      window.electron.ipcRenderer.invoke('email:startPolling').catch(console.error)
    }

    // Cleanup
    return () => {
      if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.removeListener('email:newEmails', handleNewEmails)
        window.electron.ipcRenderer.invoke('email:stopPolling').catch(console.error)
      }
    }
  }, [setEmails, setLoading, setError])
}