import { useAnnouncer } from "@/store/announcer"

/** Polite live region fed by `announce()`. Rendered once at the app root. */
export function LiveAnnouncer() {
  const { message, key } = useAnnouncer()
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      <span key={key}>{message}</span>
    </div>
  )
}
