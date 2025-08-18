/// <reference types="vite/client" />

interface ElectronAPI {
  ipcRenderer: {
    send: (channel: string, ...args: unknown[]) => void
    on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void
    once: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
