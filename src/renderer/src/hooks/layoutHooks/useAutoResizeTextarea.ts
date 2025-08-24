import { useEffect, type RefObject } from 'react'

/**
 * Hook to automatically resize a textarea based on its content
 * @param textareaRef - Reference to the textarea element
 * @param value - The current value of the textarea
 */
export function useAutoResizeTextarea(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  value: string
): void {
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to auto to get the correct scrollHeight
      textareaRef.current.style.height = 'auto'
      // Set height to scrollHeight to fit content
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [value, textareaRef])
}
