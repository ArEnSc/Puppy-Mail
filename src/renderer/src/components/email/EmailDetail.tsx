import React from 'react'
import { useEmailStore } from '@/store/emailStore'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import DOMPurify from 'dompurify'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Reply, 
  ReplyAll, 
  Forward, 
  MoreVertical, 
  Star, 
  Archive, 
  Trash2,
  Download,
  Paperclip,
  Mail
} from 'lucide-react'

export function EmailDetail() {
  const { getSelectedEmail, toggleStar, moveToTrash } = useEmailStore()
  const email = getSelectedEmail()
  
  if (!email) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/10">
        <div className="text-center">
          <Mail className="mx-auto h-16 w-16 text-muted-foreground/30" />
          <h3 className="mt-4 text-lg font-medium">Select an email to read</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose an email from the list to view its contents
          </p>
        </div>
      </div>
    )
  }
  
  const sanitizedBody = DOMPurify.sanitize(email.body, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'div', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'src', 'alt', 'class', 'style']
  })
  
  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-6">
        <h1 className="line-clamp-1 text-lg font-semibold">{email.subject}</h1>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => toggleStar(email.id)}
          >
            <Star 
              className={cn(
                "h-4 w-4",
                email.isStarred 
                  ? "fill-yellow-500 text-yellow-500" 
                  : "text-muted-foreground"
              )} 
            />
          </Button>
          <Button size="icon" variant="ghost">
            <Archive className="h-4 w-4" />
          </Button>
          <Button 
            size="icon"
            variant="ghost"
            onClick={() => moveToTrash(email.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Email Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {/* Sender Info */}
          <div className="mb-6 flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <span className="text-sm font-medium">
                  {email.from.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-medium">{email.from.name}</p>
                <p className="text-sm text-muted-foreground">&lt;{email.from.email}&gt;</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">
                {format(new Date(email.date), 'MMM d, yyyy, h:mm a')}
              </p>
              {email.to.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  to {email.to.map(t => t.name || t.email).join(', ')}
                </p>
              )}
            </div>
          </div>
          
          <Separator className="mb-6" />
          
          {/* Email Body */}
          <div 
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: sanitizedBody }}
          />
          
          {/* Attachments */}
          {email.attachments && email.attachments.length > 0 && (
            <>
              <Separator className="my-6" />
              <div>
                <h3 className="mb-3 text-sm font-medium">
                  Attachments ({email.attachments.length})
                </h3>
                <div className="space-y-2">
                  {email.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{attachment.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {(attachment.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button size="icon" variant="ghost">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
      
      <Separator />
      
      {/* Action Bar */}
      <div className="flex gap-2 p-4">
        <Button className="gap-2">
          <Reply className="h-4 w-4" />
          Reply
        </Button>
        <Button variant="outline" className="gap-2">
          <ReplyAll className="h-4 w-4" />
          Reply All
        </Button>
        <Button variant="outline" className="gap-2">
          <Forward className="h-4 w-4" />
          Forward
        </Button>
      </div>
    </div>
  )
}