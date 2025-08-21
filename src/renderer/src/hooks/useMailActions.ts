import { useState, useCallback } from 'react'
import {
  EmailComposition,
  ScheduledEmail,
  LabelOperation,
  EmailLabel,
  EmailMessage,
  MailActionResult,
  InboxListener
} from '../../../types/mailActions'

interface UseMailActionsReturn {
  isLoading: boolean
  error: string | null
  sendEmail: (composition: EmailComposition) => Promise<{ messageId: string } | null>
  scheduleEmail: (scheduledEmail: ScheduledEmail) => Promise<{ scheduledId: string } | null>
  addLabels: (operation: LabelOperation) => Promise<void | null>
  removeLabels: (operation: LabelOperation) => Promise<void | null>
  getLabels: () => Promise<EmailLabel[] | null>
  getEmails: (labelId?: string) => Promise<EmailMessage[] | null>
  listenToInbox: (filter?: InboxListener['filter'], callback?: (email: EmailMessage) => void) => Promise<{ listenerId: string } | null>
  stopListening: (listenerId: string) => Promise<void | null>
  analyzeEmail: (emailId: string, prompt: string) => Promise<string | string[] | null>
}

export function useMailActions(): UseMailActionsReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleResult = <T>(result: MailActionResult<T>): T | null => {
    if (!result.success) {
      setError(result.error?.message || 'Operation failed')
      return null
    }
    setError(null)
    return result.data || null
  }

  const sendEmail = useCallback(async (composition: EmailComposition) => {
    setIsLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('mailAction:sendEmail', composition)
      return handleResult(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const scheduleEmail = useCallback(async (scheduledEmail: ScheduledEmail) => {
    setIsLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'mailAction:scheduleEmail',
        scheduledEmail
      )
      return handleResult(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const cancelScheduledEmail = useCallback(async (scheduledId: string) => {
    setIsLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'mailAction:cancelScheduledEmail',
        scheduledId
      )
      return handleResult(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getScheduledEmails = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('mailAction:getScheduledEmails')
      return handleResult(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createDraft = useCallback(async (composition: EmailComposition) => {
    setIsLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('mailAction:createDraft', composition)
      return handleResult(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateDraft = useCallback(
    async (draftId: string, composition: Partial<EmailComposition>) => {
      setIsLoading(true)
      try {
        const result = await window.electron.ipcRenderer.invoke(
          'mailAction:updateDraft',
          draftId,
          composition
        )
        return handleResult(result)
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const deleteDraft = useCallback(async (draftId: string) => {
    setIsLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('mailAction:deleteDraft', draftId)
      return handleResult(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getDrafts = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('mailAction:getDrafts')
      return handleResult(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const addLabels = useCallback(async (operation: LabelOperation) => {
    setIsLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('mailAction:addLabels', operation)
      return handleResult(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const removeLabels = useCallback(async (operation: LabelOperation) => {
    setIsLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('mailAction:removeLabels', operation)
      return handleResult(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const setLabels = useCallback(async (operation: LabelOperation) => {
    setIsLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('mailAction:setLabels', operation)
      return handleResult(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getLabels = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('mailAction:getLabels')
      return handleResult(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createLabel = useCallback(async (label: Omit<EmailLabel, 'id'>) => {
    setIsLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('mailAction:createLabel', label)
      return handleResult(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const readEmail = useCallback(async (emailId: string) => {
    setIsLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('mailAction:readEmail', emailId)
      return handleResult(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const readEmails = useCallback(async (emailIds: string[]) => {
    setIsLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('mailAction:readEmails', emailIds)
      return handleResult(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const markAsRead = useCallback(async (emailId: string) => {
    setIsLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('mailAction:markAsRead', emailId)
      return handleResult(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const markAsUnread = useCallback(async (emailId: string) => {
    setIsLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('mailAction:markAsUnread', emailId)
      return handleResult(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const searchEmails = useCallback(async (query: string, limit?: number) => {
    setIsLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'mailAction:searchEmails',
        query,
        limit
      )
      return handleResult(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const checkInbox = useCallback(async (filter?: InboxListener['filter']) => {
    setIsLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('mailAction:checkInbox', filter)
      return handleResult(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const listenToInbox = useCallback(
    async (filter?: InboxListener['filter'], callback?: (email: EmailMessage) => void) => {
      // Set up listener for inbox updates
      if (callback) {
        const handler = (_event: unknown, email: EmailMessage): void => callback(email)
        window.electron.ipcRenderer.on('mailAction:inboxUpdate', handler)
      }

      setIsLoading(true)
      try {
        const result = await window.electron.ipcRenderer.invoke('mailAction:listenToInbox', filter)
        return handleResult(result)
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const stopListening = useCallback(async (listenerId: string) => {
    setIsLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'mailAction:stopListening',
        listenerId
      )
      // Remove all inbox update listeners
      window.electron.ipcRenderer.removeAllListeners('mailAction:inboxUpdate')
      return handleResult(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getThread = useCallback(async (threadId: string) => {
    setIsLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('mailAction:getThread', threadId)
      return handleResult(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const checkForResponse = useCallback(async (originalMessageId: string) => {
    setIsLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'mailAction:checkForResponse',
        originalMessageId
      )
      return handleResult(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    // State
    isLoading,
    error,

    // Send operations
    sendEmail,
    scheduleEmail,
    cancelScheduledEmail,
    getScheduledEmails,

    // Compose operations
    createDraft,
    updateDraft,
    deleteDraft,
    getDrafts,

    // Label operations
    addLabels,
    removeLabels,
    setLabels,
    getLabels,
    createLabel,

    // Read operations
    readEmail,
    readEmails,
    markAsRead,
    markAsUnread,
    searchEmails,

    // Inbox operations
    checkInbox,
    listenToInbox,
    stopListening,

    // Thread operations
    getThread,
    checkForResponse
  }
}
