/**
 * Shared constants used across the application
 */

// API Endpoints
export const API_ENDPOINTS = {
  LMSTUDIO_DEFAULT_URL: 'http://localhost:1234',
  OAUTH_REDIRECT_URI: 'http://localhost:3000/auth/callback',
  OAUTH_REDIRECT_PORT: 3000
} as const

// Timeouts (in milliseconds)
export const TIMEOUTS = {
  API_REQUEST: 5000, // 5 seconds
  API_COMPLETION: 30000, // 30 seconds
  EMAIL_POLL_INTERVAL: 5 // 5 minutes (value in minutes)
} as const

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
  DEFAULT_EMAIL_FETCH_LIMIT: 300
} as const

// Storage Keys
export const STORAGE_KEYS = {
  EMAIL_STORE: 'email-store',
  SETTINGS_STORE: 'email-settings',
  GOOGLE_AUTH: 'googleAuth'
} as const

// Email Labels
export const EMAIL_LABELS = {
  INBOX: 'inbox',
  IMPORTANT: 'important',
  SENT: 'sent',
  DRAFTS: 'drafts',
  TRASH: 'trash'
} as const

// UI Constants
export const UI = {
  FOLDER_LIST_WIDTH: 256,
  EMAIL_LIST_WIDTH: 384,
  MIN_FOLDER_WIDTH: 200,
  MIN_EMAIL_WIDTH: 300,
  MIN_DETAIL_WIDTH: 400
} as const

// Error Messages
export const ERROR_MESSAGES = {
  IPC_NOT_AVAILABLE: 'IPC not available - running outside Electron',
  LMSTUDIO_NOT_CONNECTED: 'Please connect to LM Studio in the settings first.',
  LMSTUDIO_CONNECTION_FAILED:
    'Cannot connect to LM Studio. Make sure it is running on the specified URL.',
  LMSTUDIO_NO_MODELS: 'No models found in LM Studio. Please load a model first.',
  AUTH_FAILED: 'Authentication failed. Please try again.',
  EMAIL_SYNC_FAILED: 'Failed to sync emails',
  EMAIL_FETCH_FAILED: 'Failed to fetch emails'
} as const

// Mock Data Time Offsets (for development)
export const MOCK_TIME_OFFSETS = {
  TASK_RECENT: 300000, // 5 minutes
  TASK_HOUR_AGO: 3000000, // 50 minutes
  TASK_DAY_AGO: 85500000, // ~24 hours
  TASK_TWO_DAYS_AGO: 172500000 // ~48 hours
} as const
