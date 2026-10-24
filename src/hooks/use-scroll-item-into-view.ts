import { useEffect } from "react"

/** Scrolls the element for `itemId` (in whichever view is showing) into view, e.g. after adding it. */
export function useScrollItemIntoView(itemId: string | null) {
  useEffect(() => {
    if (!itemId) return
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    document
      .querySelector(`[data-item-id="${itemId}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduceMotion ? "auto" : "smooth" })
  }, [itemId])
}
