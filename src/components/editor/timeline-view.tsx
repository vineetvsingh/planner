import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { useDraggable, useDroppable } from "@dnd-kit/core"
import { format, parseISO } from "date-fns"
import { Plus, TriangleAlert } from "lucide-react"

import { useDragState, type DragData } from "@/components/editor/drag-context"
import { EmptyPlanHint } from "@/components/editor/empty-plan-hint"
import { Button } from "@/components/ui/button"
import { CATEGORIES } from "@/lib/plan-meta"
import { formatClock, formatDuration, getLocation, planDays } from "@/lib/plan-utils"
import { itemsOnDay, SLOT_MINUTES } from "@/lib/schedule"
import { describeConflictFor, type PlanAnalysis } from "@/lib/schedule-analysis"
import { clamp, DAY_MINUTES, evaluatePlacement, layoutLanes, snapToSlot, type PlacementStatus } from "@/lib/timeline"
import type { Activity, ISODate, Plan, ScheduledItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import { announce } from "@/store/announcer"
import { usePlansStore } from "@/store/plans-store"

const KEYBOARD_HELP_ID = "timeline-keyboard-help"
/** Free stretches shorter than this aren't labelled; they'd only add noise. */
const MIN_LABELLED_GAP = 45
const OFF_HOURS_PATTERN =
  "repeating-linear-gradient(135deg, color-mix(in oklch, var(--muted-foreground) 12%, transparent) 0 1px, transparent 1px 7px)"

interface TimelineViewProps {
  plan: Plan
  analysis: PlanAnalysis
  selectedId: string | null
  highlightId: string | null
  targetDate: ISODate
  readOnly: boolean
  hourHeight: number
  onSelect: (itemId: string) => void
  onRemove: (itemId: string) => void
  onAddHere: (date: ISODate) => void
}

export function TimelineView(props: TimelineViewProps) {
  const { plan, hourHeight, readOnly } = props
  const days = planDays(plan)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const previousHourHeight = useRef(hourHeight)

  // Open at the start of the planning day rather than midnight.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (scroller) scroller.scrollTop = Math.max(0, ((plan.settings.dayStart - 30) / 60) * hourHeight)
    // Only on mount; later scroll position belongs to the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Zooming keeps the same time at the top of the view.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (scroller && previousHourHeight.current !== hourHeight) {
      scroller.scrollTop = (scroller.scrollTop / previousHourHeight.current) * hourHeight
      previousHourHeight.current = hourHeight
    }
  }, [hourHeight])

  const minColumn = days.length > 1 ? 11 : 16
  return (
    <div ref={scrollerRef} className="relative h-full overflow-auto overscroll-contain" data-timeline-scroller>
      <p id={KEYBOARD_HELP_ID} className="sr-only">
        {readOnly
          ? "Read-only."
          : "Arrow up or down moves 15 minutes. Arrow left or right moves to another day. Shift with arrow up or down changes the duration. Delete removes it. Enter opens details."}
      </p>
      {plan.items.length === 0 && !readOnly && (
        // Zero-height sticky layer: floats over the grid without blocking drops underneath.
        <div className="pointer-events-none sticky top-32 left-0 z-40 h-0">
          <EmptyPlanHint className="mx-auto w-[calc(100%-2rem)]" />
        </div>
      )}
      <div
        className="grid"
        style={{
          gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(${minColumn}rem, 1fr))`,
          minWidth: `calc(3.5rem + ${days.length * minColumn}rem)`,
        }}
      >
        <div className="sticky top-0 left-0 z-30 border-r border-b bg-background" />
        {days.map((date, index) => (
          <DayHeader key={date} {...props} date={date} index={index} />
        ))}

        <TimeGutter hourHeight={hourHeight} />
        {days.map((date, index) => (
          <DayColumn key={date} {...props} date={date} dayIndex={index} days={days} />
        ))}
      </div>
    </div>
  )
}

function DayHeader({
  analysis,
  date,
  index,
  targetDate,
  readOnly,
  onAddHere,
}: TimelineViewProps & { date: ISODate; index: number }) {
  const day = analysis.days[index]
  const isTarget = date === targetDate && !readOnly
  return (
    <div
      className={cn(
        "sticky top-0 z-20 flex items-center gap-1 border-r border-b bg-background py-1.5 pr-1 pl-3",
        isTarget && "shadow-[inset_0_-2px_0_var(--primary)]",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          Day {index + 1} <span className="font-normal text-muted-foreground">· {format(parseISO(date), "EEE d")}</span>
        </p>
        <p className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
          <span className="truncate">
            {day.itemCount
              ? `${day.itemCount} ${day.itemCount === 1 ? "activity" : "activities"} · ${formatDuration(day.busyMinutes)}`
              : "Free"}
          </span>
          {day.conflictCount > 0 && (
            <span className="flex shrink-0 items-center gap-0.5 font-medium text-amber-700 dark:text-amber-400">
              <TriangleAlert className="size-3" aria-hidden />
              {day.conflictCount}
              <span className="sr-only">{day.conflictCount === 1 ? "conflict" : "conflicts"}</span>
            </span>
          )}
        </p>
      </div>
      {!readOnly && (
        <Button
          variant={isTarget ? "secondary" : "ghost"}
          size="icon-xs"
          onClick={() => onAddHere(date)}
          aria-label={`Add activities to Day ${index + 1}`}
        >
          <Plus />
        </Button>
      )}
    </div>
  )
}

function TimeGutter({ hourHeight }: { hourHeight: number }) {
  return (
    <div
      className="sticky left-0 z-10 border-r bg-background"
      style={{ height: 24 * hourHeight }}
      aria-hidden
    >
      {Array.from({ length: 24 }, (_, h) => (
        <span
          key={h}
          className="absolute right-2 -translate-y-1/2 text-[0.7rem] tabular-nums text-muted-foreground"
          style={{ top: h * hourHeight }}
        >
          {h === 0 ? "" : formatClock(h * 60)}
        </span>
      ))}
    </div>
  )
}

function DayColumn(props: TimelineViewProps & { date: ISODate; dayIndex: number; days: ISODate[] }) {
  const { plan, analysis, date, dayIndex, hourHeight, readOnly } = props
  const { dragging, preview } = useDragState()
  const { setNodeRef, isOver } = useDroppable({
    id: `timeline-day:${date}`,
    data: { kind: "timeline-day", date },
    disabled: readOnly,
  })
  const pxPerMinute = hourHeight / 60
  const items = itemsOnDay(plan.items, date)
  const lanes = layoutLanes(items)
  const { dayStart, dayEnd } = plan.settings
  const activities = new Map(plan.activities.map((a) => [a.id, a]))
  const ghost = preview?.view === "timeline-day" && preview.date === date ? preview : null

  return (
    <div
      ref={setNodeRef}
      data-day-column={date}
      className={cn("relative border-r transition-colors", isOver && "bg-primary/[0.03]")}
      style={{
        height: 24 * hourHeight,
        backgroundImage: `linear-gradient(to bottom, var(--border) 1px, transparent 1px)`,
        backgroundSize: `100% ${hourHeight}px`,
      }}
    >
      {/* Outside the planning hours: still droppable, but visibly "off the clock". */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{ height: dayStart * pxPerMinute, backgroundImage: OFF_HOURS_PATTERN }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{ top: dayEnd * pxPerMinute, backgroundImage: OFF_HOURS_PATTERN }}
        aria-hidden
      />

      {plan.items.length > 0 &&
        analysis.days[dayIndex].gaps
          .filter((gap) => gap.end - gap.start >= MIN_LABELLED_GAP)
          .map((gap) => (
            <div
              key={gap.start}
              className="pointer-events-none absolute inset-x-1.5 flex justify-center overflow-hidden rounded-md border border-dashed border-border pt-1 text-[0.7rem] tabular-nums text-muted-foreground"
              style={{ top: gap.start * pxPerMinute + 3, height: (gap.end - gap.start) * pxPerMinute - 6 }}
              aria-hidden
            >
              Free · {formatDuration(gap.end - gap.start)}
            </div>
          ))}

      {items.map((item) => {
        const activity = activities.get(item.activityId)
        if (!activity) return null
        return (
          <TimelineBlock
            key={item.id}
            {...props}
            item={item}
            activity={activity}
            lane={lanes.get(item.id) ?? { lane: 0, lanes: 1 }}
            dimmed={dragging?.kind === "item" && dragging.itemId === item.id}
          />
        )
      })}

      {ghost && dragging && (
        <GhostBlock
          top={ghost.startTime * pxPerMinute}
          height={Math.min(ghost.duration, DAY_MINUTES - ghost.startTime) * pxPerMinute}
          status={ghost.status}
          label={`${formatClock(ghost.startTime)}–${formatClock((ghost.startTime + ghost.duration) % DAY_MINUTES)}`}
          message={ghost.message}
          drag={dragging}
        />
      )}
    </div>
  )
}

const STATUS_STYLES: Record<PlacementStatus, string> = {
  ok: "border-primary bg-primary/10 text-foreground",
  warning: "border-amber-500 bg-amber-100/80 text-amber-950 dark:bg-amber-950/70 dark:text-amber-100",
  invalid: "border-destructive bg-destructive/10 text-destructive",
}

function GhostBlock({
  top,
  height,
  status,
  label,
  message,
  drag,
}: {
  top: number
  height: number
  status: PlacementStatus
  label: string
  message: string
  drag: DragData
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-1 z-20 overflow-hidden rounded-md border-2 border-dashed px-2 py-1 text-xs",
        STATUS_STYLES[status],
      )}
      style={{ top, height: Math.max(height, 18) }}
      aria-hidden
    >
      <p className="font-semibold tabular-nums">
        {drag.kind === "library" ? "Add · " : "Move · "}
        {label}
      </p>
      {message && <p className="truncate">{message}</p>}
    </div>
  )
}

function TimelineBlock({
  plan,
  analysis,
  item,
  activity,
  lane,
  dimmed,
  selectedId,
  highlightId,
  readOnly,
  hourHeight,
  dayIndex,
  days,
  onSelect,
  onRemove,
}: TimelineViewProps & {
  item: ScheduledItem
  activity: Activity
  lane: { lane: number; lanes: number }
  dimmed: boolean
  dayIndex: number
  days: ISODate[]
}) {
  const [resizeDuration, setResizeDuration] = useState<number | null>(null)
  const resizeStart = useRef<{ y: number; duration: number } | null>(null)
  const { setNodeRef, listeners } = useDraggable({
    id: `item:${item.id}`,
    data: { kind: "item", itemId: item.id } satisfies DragData,
    disabled: readOnly || resizeDuration !== null,
  })

  const pxPerMinute = hourHeight / 60
  const duration = resizeDuration ?? item.duration
  const visibleMinutes = Math.min(duration, DAY_MINUTES - item.startTime)
  const height = Math.max(visibleMinutes * pxPerMinute, 16)
  const end = item.startTime + duration
  const category = CATEGORIES[activity.category]
  const location = getLocation(activity.locationId)
  const selected = item.id === selectedId
  const timeLabel = `${formatClock(item.startTime)}–${formatClock(end % DAY_MINUTES)}`
  const compact = height < 34
  const conflicts = analysis.conflictsByItem.get(item.id) ?? []
  const conflictText = conflicts.map((c) => describeConflictFor(plan, c, item.id)).join(" ")
  const resizePlacement =
    resizeDuration !== null
      ? evaluatePlacement(plan, { date: item.date, startTime: item.startTime, duration, itemId: item.id })
      : null

  function focusSelf() {
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-item-id="${item.id}"] [data-block-button]`)?.focus(),
    )
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (readOnly) return
    let next = { date: item.date, startTime: item.startTime, duration: item.duration }
    switch (event.key) {
      case "ArrowUp":
        if (event.shiftKey) next.duration -= SLOT_MINUTES
        else next.startTime -= SLOT_MINUTES
        break
      case "ArrowDown":
        if (event.shiftKey) next.duration += SLOT_MINUTES
        else next.startTime += SLOT_MINUTES
        break
      case "ArrowLeft":
        if (dayIndex === 0) return announce("Already on the first day.")
        next = { ...next, date: days[dayIndex - 1] }
        break
      case "ArrowRight":
        if (dayIndex === days.length - 1) return announce("Already on the last day.")
        next = { ...next, date: days[dayIndex + 1] }
        break
      case "Delete":
      case "Backspace":
        event.preventDefault()
        onRemove(item.id)
        return
      default:
        return
    }
    event.preventDefault()
    if (next.startTime < 0) return announce("Can't start before midnight.")
    if (next.duration < SLOT_MINUTES) return announce("Already at the shortest duration, 15 minutes.")
    const placement = evaluatePlacement(plan, { ...next, itemId: item.id })
    if (placement.status === "invalid") return announce(`Not moved. ${placement.message}.`)

    usePlansStore.getState().updateItem(plan.id, item.id, { item: next }, `keyboard:${item.id}`)
    const dayNumber = days.indexOf(next.date) + 1
    announce(
      `${activity.title}: Day ${dayNumber}, ${formatClock(next.startTime)} to ${formatClock((next.startTime + next.duration) % DAY_MINUTES)}.` +
        (placement.message ? ` ${placement.message}.` : ""),
    )
    // Changing day remounts the block in another column; keep focus on it.
    focusSelf()
  }

  function handleResizeDown(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation()
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeStart.current = { y: event.clientY, duration: item.duration }
    setResizeDuration(item.duration)
  }

  function handleResizeMove(event: PointerEvent<HTMLDivElement>) {
    const start = resizeStart.current
    if (!start) return
    const raw = start.duration + (event.clientY - start.y) / pxPerMinute
    setResizeDuration(clamp(snapToSlot(raw), SLOT_MINUTES, DAY_MINUTES - item.startTime))
  }

  function handleResizeEnd() {
    const final = resizeDuration
    resizeStart.current = null
    setResizeDuration(null)
    if (final !== null && final !== item.duration) {
      usePlansStore.getState().updateItem(plan.id, item.id, { item: { duration: final } })
      announce(`${activity.title} now lasts ${formatDuration(final)}.`)
    }
  }

  return (
    <div
      ref={setNodeRef}
      data-item-id={item.id}
      className={cn("absolute z-10 transition-opacity", dimmed && "opacity-40")}
      style={{
        top: item.startTime * pxPerMinute,
        height,
        left: `calc(${(lane.lane / lane.lanes) * 100}% + 2px)`,
        width: `calc(${100 / lane.lanes}% - 4px)`,
      }}
    >
      <button
        type="button"
        data-block-button
        {...listeners}
        onClick={() => onSelect(item.id)}
        onKeyDown={handleKeyDown}
        aria-pressed={selected}
        aria-label={`${activity.title}, ${timeLabel}${location ? `, ${location.name}` : ""}${conflictText ? `. Conflict: ${conflictText}` : ""}`}
        title={conflictText || undefined}
        aria-describedby={KEYBOARD_HELP_ID}
        className={cn(
          "relative flex h-full w-full touch-manipulation flex-col overflow-hidden rounded-md border-l-4 px-2 text-left shadow-xs outline-none transition-shadow",
          compact ? "justify-center py-0" : "py-1",
          conflicts.length > 0 && "pr-5",
          category.chip,
          category.accent,
          !readOnly && "cursor-grab active:cursor-grabbing",
          "hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/60",
          selected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
          item.id === highlightId && "animate-pulse",
          resizePlacement?.status === "warning" && "ring-2 ring-amber-500",
        )}
      >
        {conflicts.length > 0 && (
          <TriangleAlert
            className={cn(
              "absolute right-1 size-3.5 text-amber-600 dark:text-amber-400",
              compact ? "top-1/2 -translate-y-1/2" : "top-1",
            )}
            aria-hidden
          />
        )}
        {compact ? (
          <span className="truncate text-xs font-medium">
            {activity.title} <span className="font-normal opacity-75">{formatClock(item.startTime)}</span>
          </span>
        ) : (
          <>
            <span className="truncate text-xs font-semibold">{activity.title}</span>
            <span className="truncate text-[0.7rem] tabular-nums opacity-80">{timeLabel}</span>
            {height >= 56 && location && <span className="truncate text-[0.7rem] opacity-70">{location.name}</span>}
          </>
        )}
      </button>
      {resizeDuration !== null && (
        <span
          className={cn(
            "pointer-events-none absolute -bottom-6 left-1 z-30 rounded bg-popover px-1.5 py-0.5 text-[0.7rem] font-medium tabular-nums shadow ring-1 ring-border",
            resizePlacement?.status === "warning" && "text-amber-700 dark:text-amber-400",
          )}
        >
          Ends {formatClock(end % DAY_MINUTES)} · {formatDuration(duration)}
          {resizePlacement?.message && ` · ${resizePlacement.message}`}
        </span>
      )}
      {!readOnly && (
        <div
          role="presentation"
          className="absolute inset-x-1 -bottom-0.5 z-20 h-2 cursor-ns-resize rounded-full hover:bg-foreground/20"
          onPointerDown={handleResizeDown}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
          title="Drag to change duration"
        />
      )}
    </div>
  )
}

