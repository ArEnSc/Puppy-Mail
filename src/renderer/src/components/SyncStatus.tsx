import { format } from 'date-fns'
import { RefreshCw, CheckCircle } from 'lucide-react'
import { useEmailStore } from '@/store/emailStore'
import { useEmailSync } from '@/hooks/useEmailSync'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function SyncStatus(): JSX.Element {
  const { isLoading, lastSyncTime } = useEmailStore()
  const { syncEmails } = useEmailSync()

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Button variant="ghost" size="sm" onClick={syncEmails} disabled={isLoading} className="gap-2">
        <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        {isLoading ? 'Syncing...' : 'Sync'}
      </Button>

      {!isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {lastSyncTime ? (
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
