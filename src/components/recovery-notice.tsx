import { Download, TriangleAlert, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { downloadText } from "@/lib/plan-file"
import { useRecoveryNotice } from "@/store/save-status"

/** Explains, once, that saved data was damaged and what was kept, with a way to take the original. */
export function RecoveryNotice() {
  const notice = useRecoveryNotice((s) => s.notice)
  if (!notice) return null

  const message =
    notice.kind === "unreadable"
      ? "Your saved plans couldn't be read, so Plan Composer started fresh."
      : [
          notice.dropped > 0 &&
            `${notice.dropped} saved ${notice.dropped === 1 ? "plan was" : "plans were"} unreadable and left out.`,
          notice.repaired > 0 &&
            `${notice.repaired} ${notice.repaired === 1 ? "plan had" : "plans had"} damaged parts removed.`,
        ]
          .filter(Boolean)
          .join(" ")

  function downloadOriginal() {
    if (!notice) return
    let raw: string | null = null
    try {
      raw = localStorage.getItem(notice.backupKey)
    } catch {
      // Storage became unavailable; nothing to download.
    }
    if (raw !== null) downloadText(raw, `${notice.backupKey.replace(/:/g, "-")}.json`)
  }

  return (
    <div
      role="alert"
      className="mb-6 flex flex-wrap items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">Some saved data was damaged</p>
        <p>
          {message} The original is kept in this browser, so you can download it for a closer look or to ask for help.
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="bg-background" onClick={downloadOriginal}>
          <Download data-icon="inline-start" />
          Download original
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Dismiss"
          onClick={() => useRecoveryNotice.setState({ notice: null })}
        >
          <X />
        </Button>
      </div>
    </div>
  )
}
