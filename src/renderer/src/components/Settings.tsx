import { useState, useEffect, type JSX } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import { useLMStudioStore } from '@/store/lmStudioStore'
import { useEmailStore } from '@/store/emailStore'
import { useEmailSync } from '@/hooks/useEmailSync'
import { ipc } from '@/lib/ipc'
import { EMAIL_IPC_CHANNELS } from '@shared/types/email'
import { AUTH_IPC_CHANNELS } from '@shared/types/auth'
import { logInfo, logError } from '@shared/logger'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Check, Loader2, AlertCircle, ExternalLink, LogOut, Trash2 } from 'lucide-react'

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
    setApiKey,
    validateApiKey,
    setGoogleAuth,
    clearGoogleAuth
  } = useSettingsStore()

  const {
    url: lmStudioUrl,
    model: lmStudioModel,
    isConnected: lmStudioIsConnected,
    isValidating: lmStudioIsValidating,
    error: lmStudioError,
    setUrl: setLMStudioUrl,
    connect: validateLMStudio
  } = useLMStudioStore()

  const { clearAllEmails } = useEmailStore()
  const { syncEmails } = useEmailSync()
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

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
    if (isSettingsOpen && ipc.isAvailable()) {
      logInfo('Checking auth status...')
      ipc
        .invoke(AUTH_IPC_CHANNELS.AUTH_CHECK)
        .then((isAuthenticated) => {
          logInfo('Auth check result:', isAuthenticated)
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
          logError('Error checking auth:', error)
        })
    }
  }, [isSettingsOpen, setGoogleAuth])

  const handleGoogleAuth = async (): Promise<void> => {
    logInfo('handleGoogleAuth called')
    try {
      if (ipc.isAvailable()) {
        logInfo('Electron IPC available, starting OAuth')
        // Clear any previous errors
        setGoogleAuth({ error: null })

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
          logInfo('OAuth complete event received:', data)
          if (data.error) {
            logError('OAuth error received:', data.error)
            setGoogleAuth({ error: data.error })
          } else {
            logInfo('OAuth success, updating state')
            setGoogleAuth({
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
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
            logInfo('Successfully connected to Gmail!')
          }
        }

        // Set up the listener first
        ipc.once(
          AUTH_IPC_CHANNELS.AUTH_GOOGLE_COMPLETE,
          handleOAuthComplete as (...args: unknown[]) => void
        )

        // Then send the start event
        logInfo('Sending google-oauth-start')
        ipc.send(AUTH_IPC_CHANNELS.AUTH_GOOGLE_START)
      } else {
        // Fallback for development/testing
        logInfo('No Electron IPC available')
        setGoogleAuth({
          error:
            'Google OAuth requires Electron environment. In production, this would open Google sign-in.'
        })
      }
    } catch (error) {
      logError('Google auth error in Settings (catch block):', error)
      setGoogleAuth({
        error: error instanceof Error ? error.message : 'Failed to initiate Google authentication'
      })
    }
  }

  const handleClearEmails = async (): Promise<void> => {
    setIsClearing(true)
    try {
      // Clear from database
      if (ipc.isAvailable()) {
        await ipc.invoke(EMAIL_IPC_CHANNELS.EMAIL_CLEAR_ALL)
      }
      // Clear from store
      clearAllEmails()
      // Close dialog
      setShowClearDialog(false)
      // Sync new emails
      await syncEmails()
    } catch (error) {
      logError('Failed to clear emails:', error)
    } finally {
      setIsClearing(false)
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
                  Connect to your local LM Studio instance for AI-powered features using locally
                  running models.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="lmstudio-url">LM Studio Server URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="lmstudio-url"
                      type="text"
                      placeholder="http://localhost:1234/v1"
                      value={lmStudioUrl}
                      onChange={(e) => setLMStudioUrl(e.target.value)}
                      className={lmStudioError ? 'border-destructive' : ''}
                    />
                    <Button
                      type="button"
                      variant={lmStudioIsConnected ? 'outline' : 'default'}
                      size="default"
                      onClick={validateLMStudio}
                      disabled={lmStudioIsValidating || !lmStudioUrl}
                      className="min-w-[100px]"
                    >
                      {lmStudioIsValidating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testing
                        </>
                      ) : lmStudioIsConnected ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Connected
                        </>
                      ) : (
                        'Test'
                      )}
                    </Button>
                  </div>

                  {lmStudioModel && lmStudioIsConnected && (
                    <div className="mt-2">
                      <Label htmlFor="lmstudio-model">Active Model</Label>
                      <p className="text-sm text-muted-foreground">{lmStudioModel}</p>
                    </div>
                  )}

                  {lmStudioError && (
                    <p className="flex items-center gap-1 text-sm text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      {lmStudioError}
                    </p>
                  )}

                  {lmStudioIsConnected && !lmStudioError && (
                    <p className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                      <Check className="h-3 w-3" />
                      Connected to LM Studio
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Data Management */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Data Management</h3>
                <p className="text-sm text-muted-foreground">
                  Manage your locally stored email data.
                </p>
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Trash2 className="h-5 w-5 text-destructive mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <h4 className="text-sm font-semibold">Clear Local Email Database</h4>
                      <p className="text-sm text-muted-foreground">
                        This will permanently delete all emails stored locally on your device. Your
                        emails will remain in Gmail and can be synced again.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowClearDialog(true)}
                    className="w-full"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear All Local Emails
                  </Button>
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

      {/* Clear Emails Confirmation Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Local Email Database</DialogTitle>
            <DialogDescription className="space-y-3">
              <p>This action will permanently delete all emails stored locally on your device.</p>

              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
                <div className="flex gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      Important: This only affects local storage
                    </p>
                    <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                      <li>• All locally saved emails will be deleted</li>
                      <li>• Read/starred status will be lost</li>
                      <li>• Your emails remain safe in Gmail</li>
                      <li>• Fresh emails will be synced after clearing</li>
                    </ul>
                  </div>
                </div>
              </div>

              <p className="text-sm font-medium">
                This action cannot be undone. Are you sure you want to continue?
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearEmails} disabled={isClearing}>
              {isClearing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear Local Emails
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
