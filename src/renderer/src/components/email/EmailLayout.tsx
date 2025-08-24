import React from 'react'
import { FolderList } from './FolderList'
import { EmailList } from './EmailList'
import { EmailDetail } from './EmailDetail'
import { AutomatedTasksList } from './AutomatedTasksList'
import { ChatView } from './ChatView'
import { SyncStatus } from '@/components/SyncStatus'
import { useEmailStore } from '@/store/emailStore'
import { useMultiPanelResize } from '@/hooks/usePanelResize'

export function EmailLayout(): React.JSX.Element {
  // Get panel widths from store
  const { folderListWidth, emailListWidth, setPanelSizes, selectedAutomatedTask } = useEmailStore()

  // Minimum widths
  const MIN_FOLDER_WIDTH = 200
  const MIN_EMAIL_WIDTH = 300
  const MIN_DETAIL_WIDTH = 400

  // Use the custom resize hook for multiple panels
  const { resizeRefs, startResize } = useMultiPanelResize({
    panels: [
      { minWidth: MIN_FOLDER_WIDTH, currentWidth: folderListWidth },
      { minWidth: MIN_EMAIL_WIDTH, currentWidth: emailListWidth }
    ],
    onResize: (widths) => {
      // Ensure the detail panel has minimum width
      const totalUsedWidth = widths[0] + widths[1]
      if (window.innerWidth - totalUsedWidth >= MIN_DETAIL_WIDTH) {
        setPanelSizes(widths[0], widths[1])
      }
    }
  })

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sync Status Bar */}
      <SyncStatus />

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Folder List - Left Sidebar */}
        <div
          className="flex-shrink-0 border-r border-border"
          style={{ width: `${folderListWidth}px` }}
        >
          <FolderList />
        </div>

        {/* Only show middle pane if not in chat mode */}
        {selectedAutomatedTask !== 'daily-summary' && (
          <>
            {/* Resize Handle between Folder and Email List */}
            <div
              ref={(el) => (resizeRefs[0] = el)}
              className="w-1 bg-border hover:bg-primary/20 cursor-col-resize transition-colors relative group"
              onMouseDown={() => startResize(0)}
            >
              <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-primary/10" />
            </div>

            {/* Email List / Automated Tasks - Middle Pane */}
            <div
              className="flex-shrink-0 border-r border-border"
              style={{ width: `${emailListWidth}px` }}
            >
              {selectedAutomatedTask ? <AutomatedTasksList /> : <EmailList />}
            </div>

            {/* Resize Handle between Email List and Detail */}
            <div
              ref={(el) => (resizeRefs[1] = el)}
              className="w-1 bg-border hover:bg-primary/20 cursor-col-resize transition-colors relative group"
              onMouseDown={() => startResize(1)}
            >
              <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-primary/10" />
            </div>
          </>
        )}

        {/* Email Detail / Chat View - Right Pane */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {selectedAutomatedTask ? <ChatView /> : <EmailDetail />}
        </div>
      </div>
    </div>
  )
}
