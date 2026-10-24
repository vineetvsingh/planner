import { useEffect, useId, useRef, useState } from "react"
import { Check, Copy, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { encodeSharedPlan } from "@/lib/plan-file"
import type { Plan } from "@/lib/types"

/** Some chat apps and email clients truncate links longer than this. */
const LONG_LINK = 8000

interface SharePlanDialogProps {
  plan: Plan
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SharePlanDialog({ plan, open, onOpenChange }: SharePlanDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Content unmounts while closed, so each opening starts fresh with a new snapshot. */}
      <DialogContent className="sm:max-w-lg">
        <ShareLink plan={plan} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ShareLink({ plan, onDone }: { plan: Plan; onDone: () => void }) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [copied, setCopied] = useState<"yes" | "manual" | null>(null)

  useEffect(() => {
    let cancelled = false
    encodeSharedPlan(plan).then(
      (fragment) => !cancelled && setLink(`${window.location.origin}/share#${fragment}`),
      () => !cancelled && setError(true),
    )
    return () => {
      cancelled = true
    }
    // Snapshot the plan as it was when the dialog opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied("yes")
    } catch {
      // Clipboard access can be blocked; select the text so copying by hand is one shortcut away.
      inputRef.current?.select()
      setCopied("manual")
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Share a read-only link</DialogTitle>
        <DialogDescription>
          The link holds a snapshot of “{plan.name}” as it is now. Anyone with it can view the plan and save their own
          copy, but can't change yours. Nothing is uploaded: the plan travels inside the link.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <label htmlFor={`${id}-link`} className="text-sm font-medium">
          Link
        </label>
        {link ? (
          <div className="flex gap-2">
            <Input
              id={`${id}-link`}
              ref={inputRef}
              value={link}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-xs"
            />
            <Button onClick={copy} className="shrink-0">
              {copied === "yes" ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
              {copied === "yes" ? "Copied" : "Copy"}
            </Button>
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">
            This browser can't create share links. Download the plan as a file instead.
          </p>
        ) : (
          <Skeleton className="h-9" aria-label="Creating link" />
        )}
        <p className="min-h-4 text-xs text-muted-foreground" aria-live="polite">
          {copied === "yes" && "Link copied to the clipboard."}
          {copied === "manual" &&
            "Couldn't reach the clipboard. The link is selected; press Ctrl+C (⌘C on Mac) to copy it."}
        </p>
        {link && link.length > LONG_LINK && (
          <p className="text-xs text-amber-800 dark:text-amber-300">
            This plan makes a long link that some apps may cut short. If it doesn't open, send the plan as a file
            instead.
          </p>
        )}
        <p className="text-xs text-muted-foreground">To share later changes, create a new link.</p>
      </div>

      <DialogFooter>
        {link && (
          <Button variant="outline" asChild>
            <a href={link} target="_blank" rel="noreferrer">
              <ExternalLink data-icon="inline-start" />
              Preview
            </a>
          </Button>
        )}
        <Button variant="secondary" onClick={onDone}>
          Done
        </Button>
      </DialogFooter>
    </>
  )
}
