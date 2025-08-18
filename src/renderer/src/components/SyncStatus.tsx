import { format } from 'date-fns'
import { RefreshCw, CheckCircle, AlertCircle, Settings } from 'lucide-react'
import { useEmailStore } from '@/store/emailStore'
import { useEmailSync } from '@/hooks/useEmailSync'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function SyncStatus(): JSX.Element {
  const { isLoading, lastSyncTime, error } = useEmailStore()
  const { syncEmails } = useEmailSync()

  const handleOpenSettings = (): void => {
    // Dispatch a custom event to open settings
    window.dispatchEvent(new CustomEvent('open-settings'))
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Button variant="ghost" size="sm" onClick={syncEmails} disabled={isLoading} className="gap-2">
        <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        {isLoading ? 'Syncing...' : 'Sync'}
      </Button>

      {!isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {error && error.includes('Not authenticated') ? (
            <button
              onClick={handleOpenSettings}
              className="flex items-center gap-2 hover:text-foreground transition-colors cursor-pointer"
            >
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="underline underline-offset-2">
                Please connect Gmail in Settings to sync emails
              </span>
              <Settings className="h-3.5 w-3.5" />
            </button>
          ) : lastSyncTime ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Last synced: {format(lastSyncTime, 'MMM d, h:mm a')}</span>
            </>
          ) : (
            <span>Not synced yet</span>
          )}
        </div>
      )}
    </div>
  )
}
