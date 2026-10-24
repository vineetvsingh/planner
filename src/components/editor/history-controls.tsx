import { useEffect } from "react"
import { Redo2, Undo2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { MOD_KEY } from "@/lib/platform"
import { useHistoryState, usePlansStore } from "@/store/plans-store"


function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
}

/** Undo/redo buttons plus Ctrl/⌘+Z, Ctrl/⌘+Shift+Z and Ctrl+Y outside text fields. */
export function HistoryControls({ planId, disabled }: { planId: string; disabled?: boolean }) {
  const { canUndo, canRedo } = useHistoryState(planId)

  useEffect(() => {
    if (disabled) return
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || isTextInput(event.target)) return
      const key = event.key.toLowerCase()
      const { undo, redo } = usePlansStore.getState()
      if (key === "z" && !event.shiftKey) {
        event.preventDefault()
        if (!undo(planId)) toast("Nothing to undo", { id: "history" })
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault()
        if (!redo(planId)) toast("Nothing to redo", { id: "history" })
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [planId, disabled])

  return (
    <div className="flex items-center" role="group" aria-label="History">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={disabled || !canUndo}
            onClick={() => usePlansStore.getState().undo(planId)}
            aria-label="Undo"
            aria-keyshortcuts="Control+Z Meta+Z"
          >
            <Undo2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Undo <KbdGroup><Kbd>{MOD_KEY}</Kbd><Kbd>Z</Kbd></KbdGroup>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={disabled || !canRedo}
            onClick={() => usePlansStore.getState().redo(planId)}
            aria-label="Redo"
            aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
          >
            <Redo2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Redo <KbdGroup><Kbd>{MOD_KEY}</Kbd><Kbd>Shift</Kbd><Kbd>Z</Kbd></KbdGroup>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
