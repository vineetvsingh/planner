import { useDraggable, useDroppable } from "@dnd-kit/core"
import { format, parseISO } from "date-fns"
import { MapPin, Plus, TriangleAlert } from "lucide-react"

import { useDragState, type DragData } from "@/components/editor/drag-context"
import { EmptyPlanHint } from "@/components/editor/empty-plan-hint"
import { Button } from "@/components/ui/button"
import { CATEGORIES } from "@/lib/plan-meta"
import { formatClock, formatDuration, getLocation, planDays } from "@/lib/plan-utils"
import { itemsOnDay } from "@/lib/schedule"
import { describeConflictFor, type Interval, type PlanAnalysis } from "@/lib/schedule-analysis"
import { DAY_MINUTES } from "@/lib/timeline"
import type { Activity, ISODate, Plan, ScheduledItem } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Free stretches shorter than this aren't listed between activities. */
const MIN_LISTED_GAP = 30

interface ListViewProps {
  plan: Plan
  analysis: PlanAnalysis
  selectedId: string | null
  /** Briefly emphasised after being added, so the eye can follow it. */
  highlightId: string | null
  targetDate: ISODate
  readOnly: boolean
  onSelect: (itemId: string) => void
  onRemove: (itemId: string) => void
  /** Makes `date` the library's target and moves focus to the library. */
  onAddHere: (date: ISODate) => void
}

/** Days as time-ordered lists. Dropping on a day adds to its first free slot, or moves an item there keeping its time. */
export function ListView(props: ListViewProps) {
  const days = planDays(props.plan)
  return (
    <div className="relative h-full overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
        {props.plan.items.length === 0 && !props.readOnly && <EmptyPlanHint className="max-w-none" />}
        {days.map((date, index) => (
          <DaySection key={date} {...props} date={date} index={index} />
        ))}
      </div>
    </div>
  )
}

function DaySection({
  plan,
  analysis,
  date,
  index,
  selectedId,
  highlightId,
  targetDate,
  readOnly,
  onSelect,
  onRemove,
  onAddHere,
}: ListViewProps & { date: ISODate; index: number }) {
  const { dragging, preview } = useDragState()
  const { setNodeRef } = useDroppable({ id: `list-day:${date}`, data: { kind: "list-day", date }, disabled: readOnly })
  const activities = new Map(plan.activities.map((a) => [a.id, a]))
  const items = itemsOnDay(plan.items, date)
  const day = analysis.days[index]
  const gaps = day.gaps.filter((g) => g.end - g.start >= MIN_LISTED_GAP)
  /** Free stretches that end at or before `time` and haven't been shown yet. */
  let gapCursor = 0
  const gapsBefore = (time: number) => {
    const shown: Interval[] = []
    while (gapCursor < gaps.length && gaps[gapCursor].end <= time) shown.push(gaps[gapCursor++])
    return shown
  }
  const isTarget = date === targetDate && !readOnly
  const dropHere = preview?.view === "list-day" && preview.date === date ? preview : null

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`day-${date}`}
      className={cn(
        "rounded-xl border bg-card transition-shadow",
        isTarget && "border-primary/40 ring-1 ring-primary/20",
        dropHere && !dropHere.unchanged && "ring-2 ring-primary",
      )}
    >
      <header className="flex items-center gap-2 border-b py-1.5 pr-2 pl-4">
        <h3 id={`day-${date}`} className="min-w-0 flex-1 truncate text-sm font-semibold">
          Day {index + 1}{" "}
          <span className="font-normal text-muted-foreground">· {format(parseISO(date), "EEEE, MMM d")}</span>
        </h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {items.length > 0
            ? `${formatDuration(day.busyMinutes)} planned · ${formatDuration(day.freeMinutes)} free`
            : "Free day"}
        </span>
        {!readOnly && (
          <Button
            variant={isTarget ? "secondary" : "ghost"}
            size="xs"
            onClick={() => onAddHere(date)}
            aria-label={`Add activities to Day ${index + 1}`}
          >
            <Plus data-icon="inline-start" />
            {isTarget ? "Adding here" : "Add"}
          </Button>
        )}
      </header>

      {dropHere && dragging && !dropHere.unchanged && (
        <p
          aria-hidden
          className={cn(
            "mx-3 mt-2 rounded-md border-2 border-dashed px-3 py-2 text-xs font-medium",
            dropHere.status === "invalid"
              ? "border-destructive text-destructive"
              : dropHere.status === "warning"
                ? "border-amber-500 text-amber-800 dark:text-amber-300"
                : "border-primary text-foreground",
          )}
        >
          {dragging.kind === "library" ? "Add" : "Move here"} at {formatClock(dropHere.startTime)}
          {dropHere.message && ` · ${dropHere.message}`}
        </p>
      )}

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          {readOnly ? "Nothing planned." : "Nothing planned yet. Drop an activity here."}
        </p>
      ) : (
        <ol className="divide-y">
          {items.flatMap((item) => [
            ...gapsBefore(item.startTime).map((gap) => <GapRow key={`gap-${gap.start}`} gap={gap} />),
            <li key={item.id} data-item-id={item.id}>
              <ScheduledRow
                item={item}
                activity={activities.get(item.activityId)}
                conflicts={(analysis.conflictsByItem.get(item.id) ?? []).map((c) =>
                  describeConflictFor(plan, c, item.id),
                )}
                selected={item.id === selectedId}
                highlighted={item.id === highlightId}
                dimmed={dragging?.kind === "item" && dragging.itemId === item.id}
                readOnly={readOnly}
                onSelect={() => onSelect(item.id)}
                onRemove={() => onRemove(item.id)}
              />
            </li>,
          ])}
          {gapsBefore(Infinity).map((gap) => (
            <GapRow key={`gap-${gap.start}`} gap={gap} />
          ))}
        </ol>
      )}
    </section>
  )
}

function GapRow({ gap }: { gap: Interval }) {
  return (
    <li className="flex items-center gap-3 px-4 py-1.5 text-xs tabular-nums text-muted-foreground">
      <span className="w-[6.5rem] shrink-0">
        {formatClock(gap.start)}–{formatClock(gap.end % DAY_MINUTES)}
      </span>
      <span className="h-px flex-1 border-t border-dashed" aria-hidden />
      <span>Free · {formatDuration(gap.end - gap.start)}</span>
    </li>
  )
}

function ScheduledRow({
  item,
  activity,
  conflicts,
  selected,
  highlighted,
  dimmed,
  readOnly,
  onSelect,
  onRemove,
}: {
  item: ScheduledItem
  activity: Activity | undefined
  /** Plain-language descriptions of this item's scheduling problems. */
  conflicts: string[]
  selected: boolean
  highlighted: boolean
  dimmed: boolean
  readOnly: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  const { setNodeRef, listeners } = useDraggable({
    id: `item:${item.id}`,
    data: { kind: "item", itemId: item.id } satisfies DragData,
    disabled: readOnly,
  })
  const category = activity ? CATEGORIES[activity.category] : undefined
  const Icon = category?.icon
  const location = getLocation(activity?.locationId)
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (!readOnly && (e.key === "Delete" || e.key === "Backspace")) {
          e.preventDefault()
          // Keep keyboard users in place: focus the neighbouring row, or the day's Add button.
          const li = e.currentTarget.closest("li")
          const neighbour = (li?.nextElementSibling ?? li?.previousElementSibling)?.querySelector("button")
          const fallback = e.currentTarget.closest("section")?.querySelector<HTMLButtonElement>("header button")
          onRemove()
          requestAnimationFrame(() => (neighbour ?? fallback)?.focus())
        }
      }}
      aria-pressed={selected}
      aria-keyshortcuts={readOnly ? undefined : "Delete"}
      className={cn(
        "flex w-full touch-manipulation items-center gap-3 px-4 py-2.5 text-left text-sm outline-none transition-colors duration-700",
        "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
        !readOnly && "cursor-grab active:cursor-grabbing",
        selected && "bg-muted shadow-[inset_3px_0_0_var(--primary)]",
        highlighted && "bg-primary/10 duration-0",
        dimmed && "opacity-40",
      )}
    >
      <span className="w-[6.5rem] shrink-0 tabular-nums text-muted-foreground">
        {formatClock(item.startTime)}–{formatClock((item.startTime + item.duration) % DAY_MINUTES)}
      </span>
      {Icon && (
        <span className={cn("grid size-6 shrink-0 place-items-center rounded-md", category.chip)}>
          <Icon className="size-3.5" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{activity?.title ?? "Unknown activity"}</span>
        {location && (
          <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" aria-hidden />
            {location.name}
          </span>
        )}
        {conflicts.map((text) => (
          <span key={text} className="flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400">
            <TriangleAlert className="mt-px size-3 shrink-0" aria-hidden />
            {text}
          </span>
        ))}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">{formatDuration(item.duration)}</span>
    </button>
  )
}
