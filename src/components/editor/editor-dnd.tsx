import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { toast } from "sonner"

import {
  DragStateContext,
  type DragData,
  type DropData,
  type DropPreview,
} from "@/components/editor/drag-context"
import { CATEGORIES } from "@/lib/plan-meta"
import { formatClock, formatDuration, planDays } from "@/lib/plan-utils"
import { findFreeSlot, SLOT_MINUTES } from "@/lib/schedule"
import { clamp, DAY_MINUTES, evaluatePlacement, snapToSlot } from "@/lib/timeline"
import type { ISODate, Minutes, Plan } from "@/lib/types"
import { cn } from "@/lib/utils"
import { announce } from "@/store/announcer"
import type { ActivityTemplate } from "@/store/plans-store"

/** Library drops land a little above the pointer so it sits inside the new block. */
const LIBRARY_GRAB_MINUTES = 10

interface EditorDndProps {
  plan: Plan
  hourHeight: number
  /** `startTime` is undefined when dropped on a list-view day: use the first free slot. */
  onDropLibrary: (template: ActivityTemplate, date: ISODate, startTime?: Minutes) => void
  onMoveItem: (itemId: string, date: ISODate, startTime: Minutes) => void
  children: ReactNode
}

function pointerClientY(event: Event | null): number {
  if (!event) return 0
  if ("touches" in event) {
    const touch = (event as TouchEvent).touches[0] ?? (event as TouchEvent).changedTouches[0]
    return touch?.clientY ?? 0
  }
  return (event as MouseEvent).clientY
}

/**
 * Drag-and-drop for the editor. Library cards and scheduled items can be dropped on
 * timeline day columns (at the time under the pointer) or on list-view days.
 * Keyboard users get equivalents elsewhere: the library's Add buttons, and arrow keys
 * on timeline blocks.
 */
export function EditorDnd({ plan, hourHeight, onDropLibrary, onMoveItem, children }: EditorDndProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // A short press-and-hold on touch, so swiping still scrolls.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
  )
  const [dragging, setDragging] = useState<DragData | null>(null)
  const [preview, setPreview] = useState<DropPreview | null>(null)
  const grabOffset = useRef(0)
  /**
   * Latest pointer Y in viewport coordinates. dnd-kit's `delta` folds in scroll offsets,
   * which double-counts once we measure the column live, so we track the pointer ourselves.
   */
  const pointerY = useRef(0)
  const stopTracking = useRef<(() => void) | null>(null)
  // Handlers read the latest plan without re-creating the DnD context on every edit.
  const planRef = useRef(plan)
  useLayoutEffect(() => {
    planRef.current = plan
  }, [plan])

  // Leaving the editor mid-drag must not leave window listeners behind.
  useEffect(() => () => stopTracking.current?.(), [])

  const pxPerMinute = hourHeight / 60

  function titleOf(drag: DragData): string {
    if (drag.kind === "library") return drag.template.title
    const p = planRef.current
    const item = p.items.find((i) => i.id === drag.itemId)
    return p.activities.find((a) => a.id === item?.activityId)?.title ?? "Activity"
  }

  function dayLabel(date: ISODate): string {
    return `Day ${planDays(planRef.current).indexOf(date) + 1}`
  }

  function computePreview(event: DragMoveEvent | DragEndEvent): DropPreview | null {
    const drag = event.active.data.current as DragData | undefined
    const drop = event.over?.data.current as DropData | undefined
    if (!drag || !drop) return null
    const p = planRef.current
    const item = drag.kind === "item" ? p.items.find((i) => i.id === drag.itemId) : undefined
    if (drag.kind === "item" && !item) return null
    const duration = item ? item.duration : (drag as Extract<DragData, { kind: "library" }>).template.duration

    let startTime: Minutes
    if (drop.kind === "timeline-day") {
      // Measure the column live, since the timeline may have auto-scrolled mid-drag.
      const column = document.querySelector<HTMLElement>(`[data-day-column="${drop.date}"]`)
      const top = column?.getBoundingClientRect().top ?? event.over!.rect.top
      const raw = (pointerY.current - top) / pxPerMinute - grabOffset.current
      startTime = clamp(snapToSlot(raw), 0, DAY_MINUTES - SLOT_MINUTES)
    } else {
      startTime = item ? item.startTime : findFreeSlot(p.items, drop.date, duration, p.settings).startTime
    }

    const placement = evaluatePlacement(p, { date: drop.date, startTime, duration, itemId: item?.id })
    const unchanged = !!item && item.date === drop.date && item.startTime === startTime
    return { ...placement, view: drop.kind, unchanged }
  }

  function trackPointer(initialY: number) {
    pointerY.current = initialY
    const onPointer = (e: PointerEvent) => (pointerY.current = e.clientY)
    const onTouch = (e: TouchEvent) => {
      if (e.touches[0]) pointerY.current = e.touches[0].clientY
    }
    window.addEventListener("pointermove", onPointer, { capture: true, passive: true })
    window.addEventListener("touchmove", onTouch, { capture: true, passive: true })
    stopTracking.current = () => {
      window.removeEventListener("pointermove", onPointer, { capture: true })
      window.removeEventListener("touchmove", onTouch, { capture: true })
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const drag = event.active.data.current as DragData
    const startY = pointerClientY(event.activatorEvent)
    setDragging(drag)
    trackPointer(startY)
    if (drag.kind === "item") {
      // Keep the pointer at the same spot within the block while it moves. Measured from
      // the DOM so it shares the pointer's viewport coordinates.
      const node = document.querySelector(`[data-item-id="${drag.itemId}"]`)
      const top = node?.getBoundingClientRect().top ?? startY
      grabOffset.current = (startY - top) / pxPerMinute
    } else {
      grabOffset.current = LIBRARY_GRAB_MINUTES
    }
  }

  function handleDragMove(event: DragMoveEvent) {
    const next = computePreview(event)
    setPreview((prev) =>
      prev?.date === next?.date &&
      prev?.startTime === next?.startTime &&
      prev?.status === next?.status &&
      prev?.view === next?.view
        ? prev
        : next,
    )
  }

  function reset() {
    stopTracking.current?.()
    stopTracking.current = null
    setDragging(null)
    setPreview(null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const drag = event.active.data.current as DragData
    const result = computePreview(event)
    reset()
    if (!result || result.unchanged) return
    const title = titleOf(drag)
    if (result.status === "invalid") {
      toast.error(`Can't place “${title}” there`, { description: `${result.message}. Try an earlier time.` })
      announce(`Not moved. ${result.message}.`)
      return
    }
    if (drag.kind === "library") {
      onDropLibrary(drag.template, result.date, result.view === "timeline-day" ? result.startTime : undefined)
    } else {
      onMoveItem(drag.itemId, result.date, result.startTime)
      announce(
        `${title} moved to ${dayLabel(result.date)} at ${formatClock(result.startTime)}.` +
          (result.message ? ` ${result.message}.` : ""),
      )
    }
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titleOf(active.data.current as DragData)}.`,
    onDragOver: ({ over }) =>
      over ? `Over ${dayLabel((over.data.current as DropData).date)}.` : "Not over a day.",
    onDragEnd: ({ over }) => (over ? "" : "Dropped outside the plan. Nothing changed."),
    onDragCancel: () => "Drag cancelled. Nothing changed.",
  }

  const state = useMemo(() => ({ dragging, preview }), [dragging, preview])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      // Only scroll when the pointer is right at an edge, not across the top fifth of the timeline.
      autoScroll={{ threshold: { x: 0.08, y: 0.08 }, acceleration: 8 }}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={reset}
      accessibility={{ announcements }}
    >
      <DragStateContext.Provider value={state}>{children}</DragStateContext.Provider>
      <DragOverlay dropAnimation={null}>
        {dragging && <DragChip plan={plan} drag={dragging} preview={preview} dayLabel={dayLabel} />}
      </DragOverlay>
    </DndContext>
  )
}

/** Compact card under the pointer: what's moving and where it will land. */
function DragChip({
  plan,
  drag,
  preview,
  dayLabel,
}: {
  plan: Plan
  drag: DragData
  preview: DropPreview | null
  dayLabel: (date: ISODate) => string
}) {
  const item = drag.kind === "item" ? plan.items.find((i) => i.id === drag.itemId) : undefined
  const activity =
    drag.kind === "library" ? drag.template : plan.activities.find((a) => a.id === item?.activityId)
  if (!activity) return null
  const category = CATEGORIES[activity.category]
  const Icon = category.icon
  const duration = item?.duration ?? activity.duration

  let detail = "Drop on a day"
  if (preview) {
    detail =
      preview.view === "timeline-day"
        ? `${dayLabel(preview.date)} · ${formatClock(preview.startTime)}–${formatClock(Math.min(preview.startTime + duration, DAY_MINUTES) % DAY_MINUTES)}`
        : `${dayLabel(preview.date)} · ${formatClock(preview.startTime)}`
  }

  return (
    <div
      className={cn(
        "pointer-events-none flex w-60 cursor-grabbing items-center gap-2.5 rounded-lg border bg-popover p-2 text-sm shadow-lg ring-1",
        preview?.status === "invalid"
          ? "ring-destructive"
          : preview?.status === "warning"
            ? "ring-amber-500"
            : "ring-primary/30",
      )}
    >
      <span className={cn("grid size-7 shrink-0 place-items-center rounded-md", category.chip)}>
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium">{activity.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {preview?.message ? (
            <span
              className={preview.status === "invalid" ? "text-destructive" : "text-amber-700 dark:text-amber-400"}
            >
              {preview.message}
            </span>
          ) : (
            `${detail} · ${formatDuration(duration)}`
          )}
        </p>
      </div>
    </div>
  )
}
