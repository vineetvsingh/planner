import { useCallback, useState } from "react"

/** Tracks an element's rendered width. Attach the returned callback as its `ref`. */
export function useElementWidth<T extends HTMLElement>(initial = 0) {
  const [width, setWidth] = useState(initial)
  const ref = useCallback((node: T | null) => {
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}
