import { useState, useEffect } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Settings as SettingsIcon,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
  LogOut
} from 'lucide-react'

interface ApiKeyFieldProps {
  label: string
  description: string
  placeholder: string
  value: string
  error: string | null
  isValid: boolean
  isValidating: boolean
  onChange: (value: string) => void
  onValidate: () => void
  type?: string
}

function ApiKeyField({
  label,
  description,
  placeholder,
  value,
  error,
  isValid,
  isValidating,
  onChange,
  onValidate,
  type = 'password'
}: ApiKeyFieldProps): JSX.Element {
  const [showKey, setShowKey] = useState(false)

  return (
    <div className="space-y-2">
      <Label htmlFor={label}>{label}</Label>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <Input
            id={label}
            type={showKey ? 'text' : type}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={error ? 'border-destructive' : ''}
          />
          {error && (
            <p className="flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
          {isValid && !error && (
            <p className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <Check className="h-3 w-3" />
              Valid API key
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="default"
          onClick={() => setShowKey(!showKey)}
          className="px-3"
        >
          {showKey ? 'Hide' : 'Show'}
        </Button>
        <Button
          type="button"
          variant={isValid ? 'outline' : 'default'}
          size="default"
          onClick={onValidate}
          disabled={isValidating || !value}
          className="min-w-[100px]"
        >
          {isValidating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing
            </>
          ) : isValid ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Valid
            </>
          ) : (
            'Test'
          )}
        </Button>
      </div>
    </div>
  )
}

export function Settings(): JSX.Element {
  const {
    isSettingsOpen,
    setSettingsOpen,
    openai,
    anthropic,
    googleAuth,
    lmStudio,
    setApiKey,
    validateApiKey,
    setGoogleAuth,
    clearGoogleAuth,
    setLMStudioUrl,
    setLMStudioModel,
    validateLMStudio
  } = useSettingsStore()

  // Listen for open-settings event
  useEffect(() => {
    const handleOpenSettings = (): void => {
      setSettingsOpen(true)
    }
    
    window.addEventListener('openSettings', handleOpenSettings)
    return () => window.removeEventListener('openSettings', handleOpenSettings)
  }, [setSettingsOpen])

  // Check auth status when dialog opens
  useEffect(() => {
    if (isSettingsOpen && window.electron?.ipcRenderer) {
      console.log('Checking auth status...')
      window.electron.ipcRenderer
        .invoke('auth:check')
        .then((isAuthenticated) => {
          console.log('Auth check result:', isAuthenticated)
          if (isAuthenticated) {
            // Get stored user info if available
            const storedAuth = localStorage.getItem('googleAuth')
            if (storedAuth) {
              const authData = JSON.parse(storedAuth)
              setGoogleAuth({
                isAuthenticated: true,
                userEmail: authData.userEmail || 'authenticated@gmail.com',
                error: null
              })
            } else {
              // Even if no stored auth, we're authenticated
              setGoogleAuth({
                isAuthenticated: true,
                userEmail: 'authenticated@gmail.com',
                error: null
              })
            }
          }
        })
        .catch((error) => {
          console.error('Error checking auth:', error)
        })
    }
  }, [isSettingsOpen, setGoogleAuth])

  const handleGoogleAuth = async (): Promise<void> => {
    console.log('handleGoogleAuth called')
    try {
      if (window.electron?.ipcRenderer) {
        console.log('Electron IPC available, starting OAuth')
        // Clear any previous errors
        setGoogleAuth((prev) => ({ ...prev, error: null }))

        // Listen for the OAuth response BEFORE sending the start event
        const handleOAuthComplete = (
          _event: unknown,
          data: {
            error?: string
            accessToken?: string
            refreshToken?: string
            expiresAt?: number
            userEmail?: string
            isAuthenticated?: boolean
          }
        ): void => {
          console.log('OAuth complete event received:', data)
          if (data.error) {
            console.error('OAuth error received:', data.error)
            setGoogleAuth({ error: data.error })
          } else {
            console.log('OAuth success, updating state')
            setGoogleAuth({
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              expiresAt: new Date(data.expiresAt),
              userEmail: data.userEmail,
              isAuthenticated: true,
              error: null
            })

            // Save auth info to localStorage for persistence
            localStorage.setItem(
              'googleAuth',
              JSON.stringify({
                userEmail: data.userEmail,
                isAuthenticated: true
              })
            )

            // Show success notification (you could use a toast here)
            console.log('Successfully connected to Gmail!')
          }
        }

        // Set up the listener first
        window.electron.ipcRenderer.once('google-oauth-complete', handleOAuthComplete)

        // Then send the start event
        console.log('Sending google-oauth-start')
        window.electron.ipcRenderer.send('google-oauth-start')
      } else {
        // Fallback for development/testing
        console.log('No Electron IPC available')
        setGoogleAuth({
          error:
            'Google OAuth requires Electron environment. In production, this would open Google sign-in.'
        })
      }
    } catch (error) {
      console.error('Google auth error in Settings (catch block):', error)
      setGoogleAuth({
        error: error instanceof Error ? error.message : 'Failed to initiate Google authentication'
      })
    }
  }

  return (
    <>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="w-[90vw] max-w-2xl h-[90vh] max-h-[600px] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Configure your API keys and authentication for email services
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0 px-1">
            <div className="space-y-6 px-4 pb-4">
              {/* Google Authentication */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Google Gmail</h3>
                <p className="text-sm text-muted-foreground">
                  Connect your Google account to access Gmail. This uses OAuth 2.0 for secure
                  authentication.
                </p>
                {googleAuth.isAuthenticated ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-3">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm text-green-900 dark:text-green-100">
                          Connected as {googleAuth.userEmail}
                        </span>
                      </div>
                      <Button variant="outline" size="sm" onClick={clearGoogleAuth}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Disconnect
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      You can now sync your emails using the sync button in the header.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Button onClick={handleGoogleAuth} className="w-full">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Connect Google Account
                    </Button>
                    {googleAuth.error && (
                      <p className="flex items-center gap-1 text-sm text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        {googleAuth.error}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* OpenAI API Key */}
              <ApiKeyField
                label="OpenAI API Key"
                description="Used for AI-powered email summarization and smart replies. Get your API key from platform.openai.com"
                placeholder="sk-..."
                value={openai.key}
                error={openai.error}
                isValid={openai.isValid}
                isValidating={openai.isValidating}
                onChange={(value) => setApiKey('openai', value)}
                onValidate={() => validateApiKey('openai')}
              />

              <Separator />

              {/* Anthropic API Key */}
              <ApiKeyField
                label="Anthropic API Key"
                description="Alternative AI provider for email analysis using Claude. Get your API key from console.anthropic.com"
                placeholder="sk-ant-..."
                value={anthropic.key}
                error={anthropic.error}
                isValid={anthropic.isValid}
                isValidating={anthropic.isValidating}
                onChange={(value) => setApiKey('anthropic', value)}
                onValidate={() => validateApiKey('anthropic')}
              />

              <Separator />

              {/* LM Studio Local LLM */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">LM Studio (Local LLM)</h3>
                <p className="text-sm text-muted-foreground">
                  Connect to your local LM Studio instance for AI-powered features using locally running models.
                </p>
                
                <div className="space-y-2">
                  <Label htmlFor="lmstudio-url">LM Studio Server URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="lmstudio-url"
                      type="text"
                      placeholder="http://localhost:1234/v1"
                      value={lmStudio.url}
                      onChange={(e) => setLMStudioUrl(e.target.value)}
                      className={lmStudio.error ? 'border-destructive' : ''}
                    />
                    <Button
                      type="button"
                      variant={lmStudio.isConnected ? 'outline' : 'default'}
                      size="default"
                      onClick={validateLMStudio}
                      disabled={lmStudio.isValidating || !lmStudio.url}
                      className="min-w-[100px]"
                    >
                      {lmStudio.isValidating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testing
                        </>
                      ) : lmStudio.isConnected ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Connected
                        </>
                      ) : (
                        'Test'
                      )}
                    </Button>
                  </div>
                  
                  {lmStudio.model && lmStudio.isConnected && (
                    <div className="mt-2">
                      <Label htmlFor="lmstudio-model">Active Model</Label>
                      <p className="text-sm text-muted-foreground">
                        {lmStudio.model}
                      </p>
                    </div>
                  )}
                  
                  {lmStudio.error && (
                    <p className="flex items-center gap-1 text-sm text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      {lmStudio.error}
                    </p>
                  )}
                  
                  {lmStudio.isConnected && !lmStudio.error && (
                    <p className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                      <Check className="h-3 w-3" />
                      Connected to LM Studio
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Info Section */}
              <div className="rounded-lg bg-muted p-4">
                <h4 className="mb-2 text-sm font-semibold">About API Keys</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• API keys are stored locally and never sent to our servers</li>
                  <li>• Keys are encrypted and stored in your browser&apos;s local storage</li>
                  <li>• You can revoke keys at any time from the respective platforms</li>
                  <li>• Test buttons verify keys by making minimal API requests</li>
                </ul>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}
