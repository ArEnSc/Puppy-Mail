import React, { useEffect } from 'react'
import { useEmailStore } from '@/store/emailStore'
import { cn } from '@/lib/utils'
import { format, isToday, isYesterday } from 'date-fns'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Star, Paperclip, Circle, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react'
import { getLabelConfig } from '@/lib/labels'

function formatEmailDate(date: Date): string {
  if (isToday(date)) {
    return format(date, 'h:mm a')
  } else if (isYesterday(date)) {
    return 'Yesterday'
  } else {
    return format(date, 'MMM d')
  }
}

export function EmailList(): React.JSX.Element {
  const {
    selectedEmailId,
    selectEmail,
    getPaginatedEmails,
    getFilteredEmails,
    updateTotalPages,
    markAsRead,
    toggleStar,
    currentPage,
    totalPages,
    pageSize,
    nextPage,
    previousPage
  } = useEmailStore()

  const paginatedEmails = getPaginatedEmails()
  const allFilteredEmails = getFilteredEmails()
  const totalEmails = allFilteredEmails.length

  // Update total pages when filtered emails change
  useEffect(() => {
    updateTotalPages()
  }, [allFilteredEmails.length, pageSize, updateTotalPages])

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <h2 className="text-sm font-semibold">
          {totalEmails} {totalEmails === 1 ? 'message' : 'messages'}
        </h2>
        <Button size="icon" variant="ghost">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      {/* Email List */}
      <ScrollArea className="flex-1">
        {paginatedEmails.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <p className="text-sm text-muted-foreground">No emails found</p>
          </div>
        ) : (
          <div className="divide-y">
            {paginatedEmails.map((email) => (
              <div
                key={email.id}
                onClick={() => {
                  selectEmail(email.id)
                  if (!email.isRead) {
                    markAsRead(email.id)
                  }
                }}
                className={cn(
                  'flex cursor-pointer gap-3 p-4 transition-colors',
                  'hover:bg-accent/50',
                  selectedEmailId === email.id && 'bg-accent',
                  !email.isRead && 'bg-blue-50/50 dark:bg-blue-950/20'
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
                  {/* First Row: From and Date */}
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <p
                      className={cn(
                        'truncate text-sm',
                        !email.isRead ? 'font-semibold' : 'font-medium'
                      )}
                    >
                      {email.from.name || email.from.email}
                    </p>
                    <span className="flex-shrink-0 text-xs text-muted-foreground">
                      {formatEmailDate(new Date(email.date))}
                    </span>
                  </div>

                  {/* Subject */}
                  <p
                    className={cn(
                      'text-sm mb-1',
                      !email.isRead ? 'font-medium text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {email.subject}
                  </p>

                  {/* Snippet - 3 lines */}
                  <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                    {email.snippet}
                  </p>

                  {/* Labels and Actions Row */}
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {/* Star Button */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleStar(email.id)
                      }}
                    >
                      <Star
                        className={cn(
                          'h-3 w-3',
                          email.isStarred
                            ? 'fill-yellow-500 text-yellow-500'
                            : 'text-muted-foreground'
                        )}
                      />
                    </Button>

                    {/* Attachment Indicator */}
                    {email.attachments && email.attachments.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Paperclip className="h-3 w-3" />
                        <span>{email.attachments.length}</span>
                      </div>
                    )}

                    {/* Labels */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {email.labels.map((label) => {
                        const labelConfig = getLabelConfig(label)
                        return (
                          <span
                            key={label}
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                              labelConfig.bgColor,
                              labelConfig.textColor
                            )}
                          >
                            {labelConfig.name}
                          </span>
                        )
                      })}

                      {/* Show important indicator as a label if email is important */}
                      {email.isImportant && (
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            'bg-yellow-100 dark:bg-yellow-950',
                            'text-yellow-700 dark:text-yellow-300'
                          )}
                        >
                          Important
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Pagination Controls */}
      <div className="border-t">
        <div className="px-4 py-2 text-center">
          <div className="text-sm text-muted-foreground">
            Showing {Math.max(1, (currentPage - 1) * pageSize + 1)} -{' '}
            {Math.min(currentPage * pageSize, totalEmails)} of {totalEmails} emails
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Page {currentPage} of {Math.max(1, totalPages)}
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 pb-2">
          <Button
            size="sm"
            variant="outline"
            onClick={previousPage}
            disabled={currentPage === 1}
            className="flex-1 justify-center"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={nextPage}
            disabled={currentPage === totalPages || totalPages <= 1}
            className="flex-1 justify-center"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}
