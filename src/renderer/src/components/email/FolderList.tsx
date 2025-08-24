import { useEmailStore } from '@/store/emailStore'
import { useSettingsStore } from '@/store/settingsStore'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Inbox, Star, Send, FileText, Trash2, Plus, Search, Settings } from 'lucide-react'

const folderIcons = {
  inbox: Inbox,
  important: Star,
  sent: Send,
  drafts: FileText,
  trash: Trash2
}

import React from 'react'

export function FolderList(): React.JSX.Element {
  const {
    folders,
    selectedFolderId,
    selectFolder,
    searchQuery,
    setSearchQuery,
    selectAutomatedTask,
    selectedAutomatedTask
  } = useEmailStore()
  const { googleAuth } = useSettingsStore()

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Search Bar */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Separator />

      {/* Folder List */}
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-1 py-2">
          {folders.map((folder) => {
            const Icon = folderIcons[folder.id as keyof typeof folderIcons] || FileText
            return (
              <Button
                key={folder.id}
                variant={selectedFolderId === folder.id ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => selectFolder(folder.id)}
              >
                <Icon className="mr-2 h-4 w-4" />
                <span className="flex-1 text-left">{folder.name}</span>
                {folder.count > 0 && (
                  <span
                    className={cn(
                      'ml-auto text-xs',
                      selectedFolderId === folder.id
                        ? 'text-secondary-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {folder.count}
                  </span>
                )}
              </Button>
            )
          })}
        </div>

        <Separator className="my-2" />

        {/* Custom Labels Section */}
        <div className="py-2">
          <div className="mb-2 flex items-center justify-between px-3">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Labels</h3>
            <Button size="icon" variant="ghost" className="h-6 w-6">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-1">
            <Button variant="ghost" className="w-full justify-start">
              <div className="mr-2 h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-sm">Work</span>
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <div className="mr-2 h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm">Personal</span>
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <div className="mr-2 h-2 w-2 rounded-full bg-purple-500" />
              <span className="text-sm">Projects</span>
            </Button>
          </div>
        </div>

        <Separator className="my-2" />

        {/* Automated Tasks Section */}
        <div className="py-2">
          <div className="mb-2 flex items-center justify-between px-3">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">
              Automated Tasks
            </h3>
          </div>
          <div className="space-y-1">
            <Button
              variant={selectedAutomatedTask === 'daily-summary' ? 'secondary' : 'ghost'}
              className="w-full justify-start"
              onClick={() => selectAutomatedTask('daily-summary')}
            >
              <div className="mr-2 h-2 w-2 rounded-full bg-orange-500" />
              <span className="text-sm">Chat</span>
            </Button>
            <Button
              variant={selectedAutomatedTask === 'email-cleanup' ? 'secondary' : 'ghost'}
              className="w-full justify-start"
              onClick={() => selectAutomatedTask('email-cleanup')}
            >
              <div className="mr-2 h-2 w-2 rounded-full bg-cyan-500" />
              <span className="text-sm">Automated Plans</span>
            </Button>
          </div>
        </div>
      </ScrollArea>

      <Separator />

      {/* User Account Section */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <span className="text-sm font-medium">
              {googleAuth.userEmail ? googleAuth.userEmail.substring(0, 2).toUpperCase() : 'U'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {googleAuth.userEmail
                ? googleAuth.userEmail
                    .split('@')[0]
                    .replace('.', ' ')
                    .split(' ')
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')
                : 'User'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {googleAuth.userEmail || 'Not authenticated'}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => window.dispatchEvent(new CustomEvent('openSettings'))}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
