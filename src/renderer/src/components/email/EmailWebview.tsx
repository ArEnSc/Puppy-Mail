import React, { useRef, useEffect } from 'react'
import { ipc } from '@/lib/ipc'

interface EmailWebviewProps {
  htmlContent: string
  className?: string
}

export function EmailWebview({
  htmlContent,
  className = ''
}: EmailWebviewProps): React.JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (iframeRef.current && htmlContent) {
      const iframe = iframeRef.current
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document

      if (iframeDoc) {
        // Sanitize the HTML content before rendering
        // This adds an extra layer of security
        const sanitizedHtml = htmlContent
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
          .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove inline event handlers
          .replace(/javascript:/gi, '') // Remove javascript: protocol

        // Create a complete HTML document with proper styling
        const fullHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body {
                  margin: 0;
                  padding: 16px;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  font-size: 14px;
                  line-height: 1.5;
                  color: #333;
                  word-wrap: break-word;
                  overflow-wrap: break-word;
                }
                img {
                  max-width: 100%;
                  height: auto;
                }
                table {
                  max-width: 100%;
                  border-collapse: collapse;
                }
                a {
                  color: #0066cc;
                  text-decoration: none;
                }
                a:hover {
                  text-decoration: underline;
                }
                /* Prevent horizontal scrolling */
                * {
                  max-width: 100%;
                  box-sizing: border-box;
                }
                /* Dark mode support */
                @media (prefers-color-scheme: dark) {
                  body {
                    background-color: transparent;
                    color: #e0e0e0;
                  }
                  a {
                    color: #4db8ff;
                  }
                }
              </style>
            </head>
            <body>
              ${sanitizedHtml}
            </body>
          </html>
        `

        iframeDoc.open()
        iframeDoc.write(fullHtml)
        iframeDoc.close()

        // Adjust iframe height to content
        const adjustHeight = (): void => {
          if (iframe.contentWindow && iframeDoc.body) {
            const height = iframeDoc.body.scrollHeight
            iframe.style.height = `${height + 32}px` // Add padding
          }
        }

        // Wait for content to load
        iframe.onload = adjustHeight

        // Also adjust height after images load
        const images = iframeDoc.getElementsByTagName('img')
        Array.from(images).forEach((img) => {
          if (img.complete) {
            adjustHeight()
          } else {
            img.onload = adjustHeight
          }
        })

        // Handle links to open in external browser
        iframeDoc.addEventListener('click', (e) => {
          const target = e.target as HTMLElement
          if (target.tagName === 'A') {
            e.preventDefault()
            const href = target.getAttribute('href')
            if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
              // Use Electron's IPC to open external links
              if (ipc.isAvailable()) {
                ipc.send('open-external', href)
              }
            }
          }
        })
      }
    }
  }, [htmlContent])

  return (
    <iframe
      ref={iframeRef}
      className={`w-full border-0 ${className}`}
      title="Email Content"
      sandbox="allow-same-origin"
      style={{
        minHeight: '400px',
        backgroundColor: 'transparent'
      }}
    />
  )
}
