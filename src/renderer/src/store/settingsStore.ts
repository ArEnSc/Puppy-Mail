import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { API_ENDPOINTS, STORAGE_KEYS, ERROR_MESSAGES } from '@/shared/constants'
import { ipc } from '@/lib/ipc'
import { LMSTUDIO_IPC_CHANNELS } from '../../../shared/types/lmStudio'
import { logInfo, logError } from '@shared/logger'
interface ApiKeyConfig {
  key: string
  isValid: boolean
  isValidating: boolean
  error: string | null
  lastValidated: Date | null
}

interface GoogleAuthConfig {
  accessToken: string
  refreshToken: string
  expiresAt: Date | null
  userEmail: string
  isAuthenticated: boolean
  error: string | null
}

interface LMStudioConfig {
  url: string
  isConnected: boolean
  isValidating: boolean
  isAutoConnecting: boolean
  error: string | null
  lastValidated: Date | null
  model: string
}

interface SettingsState {
  openai: ApiKeyConfig
  anthropic: ApiKeyConfig
  googleAuth: GoogleAuthConfig
  lmStudio: LMStudioConfig
  isSettingsOpen: boolean

  // Actions
  setApiKey: (service: 'openai' | 'anthropic', key: string) => void
  validateApiKey: (service: 'openai' | 'anthropic') => Promise<void>
  setGoogleAuth: (auth: Partial<GoogleAuthConfig>) => void
  clearGoogleAuth: () => void
  setLMStudioUrl: (url: string) => void
  setLMStudioModel: (model: string) => void
  setLMStudioAutoConnecting: (isAutoConnecting: boolean) => void
  validateLMStudio: () => Promise<void>
  setSettingsOpen: (open: boolean) => void
  clearAllSettings: () => void
}

const defaultApiKeyConfig: ApiKeyConfig = {
  key: '',
  isValid: false,
  isValidating: false,
  error: null,
  lastValidated: null
}

const defaultGoogleAuth: GoogleAuthConfig = {
  accessToken: '',
  refreshToken: '',
  expiresAt: null,
  userEmail: '',
  isAuthenticated: false,
  error: null
}

const defaultLMStudio: LMStudioConfig = {
  url: API_ENDPOINTS.LMSTUDIO_DEFAULT_URL,
  isConnected: false,
  isValidating: false,
  isAutoConnecting: false,
  error: null,
  lastValidated: null,
  model: ''
}

// API validation functions
const validateOpenAI = async (apiKey: string): Promise<void> => {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Invalid API key' } }))
    throw new Error(error.error?.message || 'Invalid API key')
  }
}

const validateAnthropic = async (apiKey: string): Promise<void> => {
  // Anthropic doesn't have a simple validation endpoint, so we'll make a minimal request
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 1
    })
  })

  if (response.status === 401) {
    throw new Error('Invalid API key')
  } else if (!response.ok && response.status !== 400) {
    throw new Error('Failed to validate API key')
  }
}

const validateLMStudio = async (url: string): Promise<{ models: string[] }> => {
  try {
    logInfo('[Info] Validating LM Studio connection to:', url)

    // Use the new SDK connection method
    const result = await ipc.invoke<{
      success: boolean
      data?: { models: string[] }
      error?: string
    }>(LMSTUDIO_IPC_CHANNELS.LMSTUDIO_CONNECT, url)

    logInfo('[Info] LM Studio connection result:', result)

    if (!result.success) {
      logError('[Error] LM Studio connection failed:', result.error)
      throw new Error(result.error || ERROR_MESSAGES.LMSTUDIO_CONNECTION_FAILED)
    }

    logInfo('[Info] LM Studio models found:', result.data?.models?.length || 0)
    return { models: result.data?.models || [] }
  } catch (error) {
    logError('[Error] LM Studio validation error:', error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error(ERROR_MESSAGES.LMSTUDIO_CONNECTION_FAILED)
  }
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      openai: defaultApiKeyConfig,
      anthropic: defaultApiKeyConfig,
      googleAuth: defaultGoogleAuth,
      lmStudio: defaultLMStudio,
      isSettingsOpen: false,

      setApiKey: (service, key) =>
        set((state) => ({
          [service]: {
            ...state[service],
            key,
            error: null
          }
        })),

      validateApiKey: async (service) => {
        const state = get()
        const apiKey = state[service].key

        if (!apiKey) {
          set((state) => ({
            [service]: {
              ...state[service],
              error: 'API key is required',
              isValid: false
            }
          }))
          return
        }

        set((state) => ({
          [service]: {
            ...state[service],
            isValidating: true,
            error: null
          }
        }))

        try {
          switch (service) {
            case 'openai':
              await validateOpenAI(apiKey)
              break
            case 'anthropic':
              await validateAnthropic(apiKey)
              break
          }

          set((state) => ({
            [service]: {
              ...state[service],
              isValid: true,
              isValidating: false,
              error: null,
              lastValidated: new Date()
            }
          }))
        } catch (error) {
          set((state) => ({
            [service]: {
              ...state[service],
              isValid: false,
              isValidating: false,
              error: error instanceof Error ? error.message : 'Validation failed',
              lastValidated: null
            }
          }))
        }
      },

      setGoogleAuth: (auth) =>
        set((state) => ({
          googleAuth: {
            ...state.googleAuth,
            ...auth
          }
        })),

      clearGoogleAuth: () => {
        // Clear from localStorage too
        localStorage.removeItem('googleAuth')
        set({
          googleAuth: defaultGoogleAuth
        })
      },

      setLMStudioUrl: (url) =>
        set((state) => ({
          lmStudio: {
            ...state.lmStudio,
            url,
            error: null
          }
        })),

      setLMStudioModel: (model) =>
        set((state) => ({
          lmStudio: {
            ...state.lmStudio,
            model,
            error: null
          }
        })),

      setLMStudioAutoConnecting: (isAutoConnecting) =>
        set((state) => ({
          lmStudio: {
            ...state.lmStudio,
            isAutoConnecting
          }
        })),

      validateLMStudio: async () => {
        const state = get()
        const { url } = state.lmStudio

        if (!url) {
          set((state) => ({
            lmStudio: {
              ...state.lmStudio,
              error: 'URL is required',
              isConnected: false,
              isAutoConnecting: false
            }
          }))
          return
        }

        set((state) => ({
          lmStudio: {
            ...state.lmStudio,
            isValidating: true,
            error: null
          }
        }))

        try {
          const { models } = await validateLMStudio(url)

          // If no model is selected, select the first one
          const currentModel = get().lmStudio.model
          const selectedModel = currentModel || models[0]

          set((state) => ({
            lmStudio: {
              ...state.lmStudio,
              isConnected: true,
              isValidating: false,
              isAutoConnecting: false,
              error: null,
              lastValidated: new Date(),
              model: selectedModel
            }
          }))
        } catch (error) {
          set((state) => ({
            lmStudio: {
              ...state.lmStudio,
              isConnected: false,
              isValidating: false,
              isAutoConnecting: false,
              error: error instanceof Error ? error.message : 'Connection failed',
              lastValidated: null
            }
          }))
        }
      },

      setSettingsOpen: (open) => set({ isSettingsOpen: open }),

      clearAllSettings: () =>
        set({
          openai: defaultApiKeyConfig,
          anthropic: defaultApiKeyConfig,
          googleAuth: defaultGoogleAuth,
          lmStudio: defaultLMStudio
        })
    }),
    {
      name: STORAGE_KEYS.SETTINGS_STORE,
      partialize: (state) => ({
        openai: { key: state.openai.key },
        anthropic: { key: state.anthropic.key },
        googleAuth: {
          refreshToken: state.googleAuth.refreshToken,
          userEmail: state.googleAuth.userEmail
        },
        lmStudio: {
          url: state.lmStudio.url,
          model: state.lmStudio.model
        }
      })
    }
  )
)
