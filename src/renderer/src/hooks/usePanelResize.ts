import { useRef, useEffect, useCallback } from 'react'

interface UsePanelResizeOptions {
  minWidth: number
  maxWidth?: number
  onResize: (newWidth: number) => void
  direction?: 'left' | 'right'
}

export function usePanelResize({
  minWidth,
  maxWidth,
  onResize,
  direction = 'left'
}: UsePanelResizeOptions): {
  resizeRef: React.RefObject<HTMLDivElement>
  startResize: () => void
} {
  const resizeRef = useRef<HTMLDivElement>(null)
  const isResizingRef = useRef(false)

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizingRef.current) return

      const newWidth = direction === 'left' ? e.clientX : window.innerWidth - e.clientX

      // Apply constraints
      const constrainedWidth = Math.max(
        minWidth,
        maxWidth ? Math.min(newWidth, maxWidth) : newWidth
      )

      onResize(constrainedWidth)
    },
    [minWidth, maxWidth, onResize, direction]
  )

  const handleMouseUp = useCallback(() => {
    if (!isResizingRef.current) return

    isResizingRef.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''

    if (resizeRef.current) {
      resizeRef.current.dataset.resizing = 'false'
    }
  }, [])

  const startResize = useCallback(() => {
    isResizingRef.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    if (resizeRef.current) {
      resizeRef.current.dataset.resizing = 'true'
    }
  }, [])

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  return {
    resizeRef,
    startResize
  }
}

interface UseMultiPanelResizeOptions {
  panels: {
    minWidth: number
    maxWidth?: number
    currentWidth: number
  }[]
  onResize: (widths: number[]) => void
}

export function useMultiPanelResize({ panels, onResize }: UseMultiPanelResizeOptions): {
  resizeRefs: (HTMLDivElement | null)[]
  startResize: (index: number) => void
} {
  const resizeRefs = useRef<(HTMLDivElement | null)[]>(panels.map(() => null))
  const activeResizeIndex = useRef<number | null>(null)

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (activeResizeIndex.current === null) return

      const index = activeResizeIndex.current
      const currentWidths = panels.map((p) => p.currentWidth)

      // Calculate new width based on mouse position
      let cumulativeWidth = 0
      for (let i = 0; i <= index; i++) {
        cumulativeWidth += currentWidths[i]
      }

      const newWidth = e.clientX - (cumulativeWidth - currentWidths[index])

      // Apply constraints
      const { minWidth, maxWidth } = panels[index]
      const constrainedWidth = Math.max(
        minWidth,
        maxWidth ? Math.min(newWidth, maxWidth) : newWidth
      )

      // Check if remaining space is sufficient
      const totalWidth = window.innerWidth
      const usedWidth = currentWidths.reduce(
        (sum, w, i) => (i === index ? sum + constrainedWidth : sum + w),
        0
      )

      if (totalWidth - usedWidth >= (panels[panels.length - 1]?.minWidth || 0)) {
        const newWidths = [...currentWidths]
        newWidths[index] = constrainedWidth
        onResize(newWidths)
      }
    },
    [panels, onResize]
  )

  const handleMouseUp = useCallback(() => {
    if (activeResizeIndex.current === null) return

    const index = activeResizeIndex.current
    activeResizeIndex.current = null

    document.body.style.cursor = ''
    document.body.style.userSelect = ''

    const ref = resizeRefs.current[index]
    if (ref) {
      ref.dataset.resizing = 'false'
    }
  }, [])

  const startResize = useCallback((index: number) => {
    activeResizeIndex.current = index
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const ref = resizeRefs.current[index]
    if (ref) {
      ref.dataset.resizing = 'true'
    }
  }, [])

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  return {
    resizeRefs: resizeRefs.current,
    startResize
  }
}
