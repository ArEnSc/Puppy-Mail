/**
 * IPC wrapper utility for consistent Electron IPC communication
 */
import { logError, logWarning } from '@shared/logger'

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
      return (await window.electron.ipcRenderer.invoke(channel, ...args)) as T
    } catch (error) {
      logError(`IPC error on channel ${channel}:`, error)
      throw error
    }
  }

  /**
   * Send a one-way IPC message
   */
  send(channel: string, ...args: unknown[]): void {
    if (!this.available) {
      logWarning('IPC not available - running outside Electron')
      return
    }

    window.electron.ipcRenderer.send(channel, ...args)
  }

  /**
   * Listen to IPC events
   */
  on(channel: string, callback: (...args: unknown[]) => void): () => void {
    if (!this.available) {
      logWarning('IPC not available - running outside Electron')
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
      logWarning('IPC not available - running outside Electron')
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
