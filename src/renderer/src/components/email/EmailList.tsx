import React from 'react'
import { useEmailStore } from '@/store/emailStore'
import { cn } from '@/lib/utils'
import { format, isToday, isYesterday } from 'date-fns'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Star, Paperclip, Circle, MoreHorizontal } from 'lucide-react'

function formatEmailDate(date: Date): string {
  if (isToday(date)) {
    return format(date, 'h:mm a')
  } else if (isYesterday(date)) {
    return 'Yesterday'
  } else {
    return format(date, 'MMM d')
  }
}

export function EmailList() {
  const { 
    selectedEmailId, 
    selectEmail, 
    getFilteredEmails,
    markAsRead,
    toggleStar 
  } = useEmailStore()
  
  const emails = getFilteredEmails()
  
  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <h2 className="text-sm font-semibold">
          {emails.length} {emails.length === 1 ? 'message' : 'messages'}
        </h2>
        <Button size="icon" variant="ghost">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Email List */}
      <ScrollArea className="flex-1">
        {emails.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <p className="text-sm text-muted-foreground">No emails found</p>
          </div>
        ) : (
          <div className="divide-y">
            {emails.map((email) => (
              <div
                key={email.id}
                onClick={() => {
                  selectEmail(email.id)
                  if (!email.isRead) {
                    markAsRead(email.id)
                  }
                }}
                className={cn(
                  "flex cursor-pointer gap-3 p-4 transition-colors",
                  "hover:bg-accent/50",
                  selectedEmailId === email.id && "bg-accent",
                  !email.isRead && "bg-blue-50/50 dark:bg-blue-950/20"
                )}
              >
                {/* Unread Indicator */}
                <div className="flex-shrink-0 pt-1">
                  {!email.isRead ? (
                    <Circle className="h-2 w-2 fill-primary text-primary" />
                  ) : (
                    <div className="h-2 w-2" />
                  )}
                </div>
                
                {/* Email Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={cn(
                      "truncate text-sm",
                      !email.isRead ? "font-semibold" : "font-medium"
                    )}>
                      {email.from.name || email.from.email}
                    </p>
                    <span className="flex-shrink-0 text-xs text-muted-foreground">
                      {formatEmailDate(new Date(email.date))}
                    </span>
                  </div>
                  
                  <p className={cn(
                    "truncate text-sm",
                    !email.isRead ? "font-medium text-foreground" : "text-muted-foreground"
                  )}>
                    {email.subject}
                  </p>
                  
                  <p className="truncate text-sm text-muted-foreground">
                    {email.snippet}
                  </p>
                  
                  <div className="mt-1 flex items-center gap-2">
                    {email.attachments && email.attachments.length > 0 && (
                      <Paperclip className="h-3 w-3 text-muted-foreground" />
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleStar(email.id)
                      }}
                    >
                      <Star 
                        className={cn(
                          "h-3 w-3",
                          email.isStarred 
                            ? "fill-yellow-500 text-yellow-500" 
                            : "text-muted-foreground"
                        )} 
                      />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}