import React from 'react'
import { FolderList } from './FolderList'
import { EmailList } from './EmailList'
import { EmailDetail } from './EmailDetail'
import { cn } from '@/lib/utils'

export function EmailLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
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
  )
}