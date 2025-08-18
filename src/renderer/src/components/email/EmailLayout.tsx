import { useRef, useEffect } from 'react'
import { FolderList } from './FolderList'
import { EmailList } from './EmailList'
import { EmailDetail } from './EmailDetail'
import { SyncStatus } from '@/components/SyncStatus'
import { useEmailStore } from '@/store/emailStore'

export function EmailLayout(): JSX.Element {
  // Get panel widths from store
  const { folderListWidth, emailListWidth, setPanelSizes } = useEmailStore()

  // Refs for resize handles
  const folderResizeRef = useRef<HTMLDivElement>(null)
  const emailResizeRef = useRef<HTMLDivElement>(null)

  // Minimum widths
  const MIN_FOLDER_WIDTH = 200
  const MIN_EMAIL_WIDTH = 300
  const MIN_DETAIL_WIDTH = 400

  useEffect(() => {
    const handleFolderResize = (e: MouseEvent): void => {
      const newWidth = e.clientX
      if (
        newWidth >= MIN_FOLDER_WIDTH &&
        window.innerWidth - newWidth - emailListWidth >= MIN_DETAIL_WIDTH
      ) {
        setPanelSizes(newWidth, emailListWidth)
      }
    }

    const handleEmailResize = (e: MouseEvent): void => {
      const newWidth = e.clientX - folderListWidth
      if (
        newWidth >= MIN_EMAIL_WIDTH &&
        window.innerWidth - folderListWidth - newWidth >= MIN_DETAIL_WIDTH
      ) {
        setPanelSizes(folderListWidth, newWidth)
      }
    }

    const handleMouseMove = (e: MouseEvent): void => {
      if (folderResizeRef.current?.dataset.resizing === 'true') {
        handleFolderResize(e)
      } else if (emailResizeRef.current?.dataset.resizing === 'true') {
        handleEmailResize(e)
      }
    }

    const handleMouseUp = (): void => {
      if (folderResizeRef.current) folderResizeRef.current.dataset.resizing = 'false'
      if (emailResizeRef.current) emailResizeRef.current.dataset.resizing = 'false'
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [folderListWidth, emailListWidth, setPanelSizes])

  const handleResizeStart = (ref: React.RefObject<HTMLDivElement>): void => {
    if (ref.current) {
      ref.current.dataset.resizing = 'true'
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
  }

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

        {/* Resize Handle between Folder and Email List */}
        <div
          ref={folderResizeRef}
          className="w-1 bg-border hover:bg-primary/20 cursor-col-resize transition-colors relative group"
          onMouseDown={() => handleResizeStart(folderResizeRef)}
        >
          <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-primary/10" />
        </div>

        {/* Email List - Middle Pane */}
        <div
          className="flex-shrink-0 border-r border-border"
          style={{ width: `${emailListWidth}px` }}
        >
          <EmailList />
        </div>

        {/* Resize Handle between Email List and Detail */}
        <div
          ref={emailResizeRef}
          className="w-1 bg-border hover:bg-primary/20 cursor-col-resize transition-colors relative group"
          onMouseDown={() => handleResizeStart(emailResizeRef)}
        >
          <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-primary/10" />
        </div>

        {/* Email Detail - Right Pane */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <EmailDetail />
        </div>
      </div>
    </div>
  )
}

