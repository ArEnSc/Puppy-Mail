import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {}

// Create a custom ipcRenderer that includes all our channels
const customIpcRenderer = {
  invoke: (channel: string, ...args: unknown[]) => {
    const validChannels = [
      'email:fetch',
      'email:sync',
      'email:send',
      'email:startPolling',
      'email:stopPolling',
      'auth:check',
      'auth:start',
      'auth:logout',
      'settings:get',
      'settings:set',
      'lmstudio:validate',
      'lmstudio:chat',
      'lmstudio:getAvailableFunctions',
      // Mail action channels
      'mailAction:sendEmail',
      'mailAction:scheduleEmail',
      'mailAction:cancelScheduledEmail',
      'mailAction:getScheduledEmails',
      'mailAction:createDraft',
      'mailAction:updateDraft',
      'mailAction:deleteDraft',
      'mailAction:getDrafts',
      'mailAction:addLabels',
      'mailAction:removeLabels',
      'mailAction:setLabels',
      'mailAction:getLabels',
      'mailAction:createLabel',
      'mailAction:readEmail',
      'mailAction:readEmails',
      'mailAction:markAsRead',
      'mailAction:markAsUnread',
      'mailAction:searchEmails',
      'mailAction:checkInbox',
      'mailAction:listenToInbox',
      'mailAction:stopListening',
      'mailAction:getThread',
      'mailAction:checkForResponse'
    ]
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
    // For any other channels, try the original electronAPI
    if (electronAPI.ipcRenderer?.invoke) {
      return electronAPI.ipcRenderer.invoke(channel, ...args)
    }
    throw new Error(`Invalid channel: ${channel}`)
  },
  on: (
    channel: string,
    listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void
  ) => {
    const validChannels = [
      'email:newEmails',
      'email:syncComplete',
      'google-oauth-complete',
      'lmstudio:stream:chunk',
      'lmstudio:stream:error',
      'lmstudio:stream:complete',
      'lmstudio:stream:functionCall',
      'mailAction:inboxUpdate'
    ]
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, listener)
      return
    }
    if (electronAPI.ipcRenderer?.on) {
      electronAPI.ipcRenderer.on(channel, listener)
    }
  },
  removeListener: (
    channel: string,
    listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void
  ) => {
    const validChannels = [
      'email:newEmails',
      'email:syncComplete',
      'google-oauth-complete',
      'lmstudio:stream:chunk',
      'lmstudio:stream:error',
      'lmstudio:stream:complete',
      'lmstudio:stream:functionCall',
      'mailAction:inboxUpdate'
    ]
    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, listener)
      return
    }
    if (electronAPI.ipcRenderer?.removeListener) {
      electronAPI.ipcRenderer.removeListener(channel, listener)
    }
  },
  off: (
    channel: string,
    listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void
  ) => {
    const validChannels = [
      'email:newEmails',
      'email:syncComplete',
      'google-oauth-complete',
      'lmstudio:stream:chunk',
      'lmstudio:stream:error',
      'lmstudio:stream:complete',
      'lmstudio:stream:functionCall',
      'mailAction:inboxUpdate'
    ]
    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, listener)
      return
    }
    if (electronAPI.ipcRenderer?.removeListener) {
      electronAPI.ipcRenderer.removeListener(channel, listener)
    }
  },
  once: (
    channel: string,
    listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void
  ) => {
    const validChannels = [
      'email:newEmails',
      'email:syncComplete',
      'google-oauth-complete',
      'lmstudio:stream:chunk',
      'lmstudio:stream:error',
      'lmstudio:stream:complete',
      'lmstudio:stream:functionCall',
      'mailAction:inboxUpdate'
    ]
    if (validChannels.includes(channel)) {
      ipcRenderer.once(channel, listener)
      return
    }
    if (electronAPI.ipcRenderer?.once) {
      electronAPI.ipcRenderer.once(channel, listener)
    }
  },
  send: (channel: string, ...args: unknown[]) => {
    const validChannels = ['google-oauth-start', 'open-external', 'lmstudio:stream']
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args)
      return
    }
    if (electronAPI.ipcRenderer?.send) {
      electronAPI.ipcRenderer.send(channel, ...args)
    }
  }
}

// Extend electronAPI with our custom ipcRenderer
const extendedElectronAPI = {
  ...electronAPI,
  ipcRenderer: customIpcRenderer
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', extendedElectronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = extendedElectronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
