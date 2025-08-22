/**
 * IPC wrapper utility for consistent Electron IPC communication
 */

class IPCClient {
  private available: boolean

  constructor() {
    this.available = !!window.electron?.ipcRenderer
  }

  /**
   * Check if IPC is available
   */
  isAvailable(): boolean {
    return this.available
  }

  /**
   * Invoke an IPC method with error handling
   */
  async invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
    if (!this.available) {
      throw new Error('IPC not available - running outside Electron')
    }

    try {
      return await window.electron.ipcRenderer.invoke(channel, ...args)
    } catch (error) {
      console.error(`IPC error on channel ${channel}:`, error)
      throw error
    }
  }

  /**
   * Send a one-way IPC message
   */
  send(channel: string, ...args: unknown[]): void {
    if (!this.available) {
      console.warn('IPC not available - running outside Electron')
      return
    }

    window.electron.ipcRenderer.send(channel, ...args)
  }

  /**
   * Listen to IPC events
   */
  on(channel: string, callback: (...args: unknown[]) => void): () => void {
    if (!this.available) {
      console.warn('IPC not available - running outside Electron')
      return () => {} // Return noop unsubscribe
    }

    window.electron.ipcRenderer.on(channel, callback)

    // Return unsubscribe function
    return () => {
      window.electron.ipcRenderer.off(channel, callback)
    }
  }

  /**
   * Listen to IPC events once
   */
  once(channel: string, callback: (...args: unknown[]) => void): void {
    if (!this.available) {
      console.warn('IPC not available - running outside Electron')
      return
    }

    window.electron.ipcRenderer.once(channel, callback)
  }

  /**
   * Remove IPC event listener
   */
  off(channel: string, callback: (...args: unknown[]) => void): void {
    if (!this.available) {
      return
    }

    window.electron.ipcRenderer.off(channel, callback)
  }
}

// Export singleton instance
export const ipc = new IPCClient()

// Export typed IPC channels for better type safety
export const IPC_CHANNELS = {
  // Email operations
  EMAIL_FETCH: 'email:fetch',
  EMAIL_SYNC: 'email:sync',
  EMAIL_START_POLLING: 'email:startPolling',
  EMAIL_STOP_POLLING: 'email:stopPolling',
  EMAIL_MARK_AS_READ: 'email:markAsRead',
  EMAIL_TOGGLE_STAR: 'email:toggleStar',
  EMAIL_CLEAR_ALL: 'email:clearAll',

  // Email events
  EMAIL_NEW_EMAILS: 'email:newEmails',
  EMAIL_SYNC_COMPLETE: 'email:syncComplete',

  // Auth operations
  AUTH_CHECK: 'auth:check',
  AUTH_GOOGLE_START: 'google-oauth-start',
  AUTH_GOOGLE_COMPLETE: 'google-oauth-complete',

  // LM Studio operations
  LMSTUDIO_VALIDATE: 'lmstudio:validate',
  LMSTUDIO_CHAT: 'lmstudio:chat',
  LMSTUDIO_STREAM: 'lmstudio:stream',

  // LM Studio events
  LMSTUDIO_STREAM_CHUNK: 'lmstudio:stream:chunk',
  LMSTUDIO_STREAM_ERROR: 'lmstudio:stream:error',
  LMSTUDIO_STREAM_COMPLETE: 'lmstudio:stream:complete',
  LMSTUDIO_STREAM_FUNCTION_CALL: 'lmstudio:stream:functionCall'
} as const
