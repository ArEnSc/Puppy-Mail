/**
 * Shared types for Authentication IPC communication
 */

export const AUTH_IPC_CHANNELS = {
  AUTH_CHECK: 'auth:check',
  AUTH_GOOGLE_START: 'google-oauth-start',
  AUTH_GOOGLE_COMPLETE: 'google-oauth-complete'
} as const

export type AuthIPCChannel = (typeof AUTH_IPC_CHANNELS)[keyof typeof AUTH_IPC_CHANNELS]
