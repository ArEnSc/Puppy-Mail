import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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

interface SettingsState {
  openai: ApiKeyConfig
  anthropic: ApiKeyConfig
  googleAuth: GoogleAuthConfig
  isSettingsOpen: boolean

  // Actions
  setApiKey: (service: 'openai' | 'anthropic', key: string) => void
  validateApiKey: (service: 'openai' | 'anthropic') => Promise<void>
  setGoogleAuth: (auth: Partial<GoogleAuthConfig>) => void
  clearGoogleAuth: () => void
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

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      openai: defaultApiKeyConfig,
      anthropic: defaultApiKeyConfig,
      googleAuth: defaultGoogleAuth,
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

      clearGoogleAuth: () =>
        set({
          googleAuth: defaultGoogleAuth
        }),

      setSettingsOpen: (open) => set({ isSettingsOpen: open }),

      clearAllSettings: () =>
        set({
          openai: defaultApiKeyConfig,
          anthropic: defaultApiKeyConfig,
          googleAuth: defaultGoogleAuth
        })
    }),
    {
      name: 'email-settings',
      partialize: (state) => ({
        openai: { key: state.openai.key },
        anthropic: { key: state.anthropic.key },
        googleAuth: {
          refreshToken: state.googleAuth.refreshToken,
          userEmail: state.googleAuth.userEmail
        }
      })
    }
  )
)
