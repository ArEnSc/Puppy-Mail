import { ElectronAPI } from '@electron-toolkit/preload'

interface ExtendedElectronAPI extends ElectronAPI {
  ipcRenderer: {
    on(channel: string, listener: (...args: unknown[]) => void): void
    off(channel: string, listener: (...args: unknown[]) => void): void
    once(channel: string, listener: (...args: unknown[]) => void): void
    send(channel: string, ...args: unknown[]): void
    invoke(channel: string, ...args: unknown[]): Promise<unknown>
  }
}

declare global {
  interface Window {
    electron: ExtendedElectronAPI
    api: unknown
  }
}
