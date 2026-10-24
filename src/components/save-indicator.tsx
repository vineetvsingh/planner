import { useEffect } from "react"
import { CircleAlert, CloudCheck } from "lucide-react"
import { toast } from "sonner"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { downloadBackup } from "@/lib/plan-file"
import { usePlansStore } from "@/store/plans-store"
import { useSaveStatus } from "@/store/save-status"

export function SaveIndicator() {
  const save = useSaveStatus()

  useEffect(() => {
    if (save.status === "error") {
      toast.error("Changes couldn't be saved", {
        id: "save-error",
        description: `${save.message} Your edits stay in this tab, but will be lost if you close it. Download a backup to keep them.`,
        duration: Infinity,
        action: { label: "Download backup", onClick: () => downloadBackup(usePlansStore.getState().plans) },
      })
    } else {
      toast.dismiss("save-error")
    }
  }, [save])

  // While saving is failing, closing the tab would lose work: ask the browser to confirm.
  useEffect(() => {
    if (save.status !== "error") return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [save.status])

  if (save.status === "error") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="status"
            tabIndex={0}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-destructive outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <CircleAlert className="size-3.5" aria-hidden />
            Not saved
          </span>
        </TooltipTrigger>
        <TooltipContent>{save.message}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <span role="status" className="flex shrink-0 items-center gap-1.5 px-1 py-1 text-xs text-muted-foreground sm:px-2">
      <CloudCheck className="size-3.5" aria-hidden />
      {/* Icon only on phones; the text stays available to screen readers. */}
      <span className="max-sm:sr-only">{save.status === "saved" ? "All changes saved" : "Saved on this device"}</span>
    </span>
  )
}
