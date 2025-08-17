/// <reference types="vite/client" />

interface ElectronAPI {
  ipcRenderer: {
    send: (channel: string, ...args: any[]) => void
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => void
    once: (channel: string, listener: (event: any, ...args: any[]) => void) => void
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
