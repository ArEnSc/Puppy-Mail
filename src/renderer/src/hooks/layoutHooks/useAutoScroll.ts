import { useEffect, type RefObject } from 'react'

/**
 * Hook to automatically scroll to bottom when dependencies change
 * @param scrollRef - Reference to the scroll container element
 * @param dependencies - Array of dependencies that trigger scroll
 * @param selector - Optional CSS selector for the scroll viewport (default: '[data-radix-scroll-area-viewport]')
 */
export function useAutoScroll(
  scrollRef: RefObject<HTMLElement | null>,
  dependencies: unknown[],
  selector = '[data-radix-scroll-area-viewport]'
): void {
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = selector
        ? scrollRef.current.querySelector(selector)
        : scrollRef.current

      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
}
