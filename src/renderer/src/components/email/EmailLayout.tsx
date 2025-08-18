import { FolderList } from './FolderList'
import { EmailList } from './EmailList'
import { EmailDetail } from './EmailDetail'
import { SyncStatus } from '@/components/SyncStatus'

export function EmailLayout(): JSX.Element {
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sync Status Bar */}
      <SyncStatus />

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Folder List - Left Sidebar */}
        <div className="w-64 flex-shrink-0 border-r border-border">
          <FolderList />
        </div>

        {/* Email List - Middle Pane */}
        <div className="w-96 flex-shrink-0 border-r border-border">
          <EmailList />
        </div>

        {/* Email Detail - Right Pane */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <EmailDetail />
        </div>
      </div>
    </div>
  )
}
