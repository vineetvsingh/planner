import { CalendarPlus } from "lucide-react"

import { cn } from "@/lib/utils"

/** First-use guidance shown in either view while the plan has no activities. */
export function EmptyPlanHint({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex max-w-md items-start gap-3 rounded-lg border border-dashed bg-card/95 p-4 text-sm shadow-sm backdrop-blur",
        className,
      )}
    >
      <CalendarPlus className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div>
        <p className="font-medium">Your plan is empty</p>
        <p className="text-muted-foreground">
          Drag activities from the library onto a day and time, or pick a day with its + button and add from the
          library. You can fine-tune everything afterwards.
        </p>
      </div>
    </div>
  )
}
