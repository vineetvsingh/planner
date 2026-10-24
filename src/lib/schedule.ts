import type { ISODate, Minutes, PlanSettings, ScheduledItem } from "@/lib/types"

/** Granularity for start times and durations. */
export const SLOT_MINUTES = 15
export const MAX_DURATION = 12 * 60

export const DURATION_PRESETS: Minutes[] = [
  15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360, 420, 480, 600, 720,
]

/** Start times every 15 minutes, 00:00–23:45. */
export const START_TIME_OPTIONS: Minutes[] = Array.from({ length: (24 * 60) / SLOT_MINUTES }, (_, i) => i * SLOT_MINUTES)

export function itemsOnDay(items: ScheduledItem[], date: ISODate): ScheduledItem[] {
  return items.filter((i) => i.date === date).sort(compareItems)
}

export function compareItems(a: ScheduledItem, b: ScheduledItem): number {
  return a.startTime - b.startTime || a.order - b.order
}

/** Rewrites `order` so each day's items are numbered 0..n in time order. */
export function normalizeOrder(items: ScheduledItem[]): ScheduledItem[] {
  const counters = new Map<ISODate, number>()
  const orderById = new Map<string, number>()
  for (const item of [...items].sort((a, b) => a.date.localeCompare(b.date) || compareItems(a, b))) {
    const next = counters.get(item.date) ?? 0
    orderById.set(item.id, next)
    counters.set(item.date, next + 1)
  }
  return items.map((i) => (i.order === orderById.get(i.id) ? i : { ...i, order: orderById.get(i.id)! }))
}

export interface SlotResult {
  startTime: Minutes
  /** False when no gap inside the day window was long enough, so the item was placed after the last one. */
  fits: boolean
}

/**
 * Earliest start on `date` where an item of `duration` fits inside the day window
 * without overlapping anything, on the 15-minute grid. Falls back to right after
 * the last item so adding never fails; the overlap/overflow is then flagged in the UI.
 */
export function findFreeSlot(
  items: ScheduledItem[],
  date: ISODate,
  duration: Minutes,
  settings: Pick<PlanSettings, "dayStart" | "dayEnd">,
): SlotResult {
  const day = itemsOnDay(items, date)
  let cursor = snapUp(settings.dayStart)
  for (const item of day) {
    if (cursor + duration <= item.startTime) break
    cursor = Math.max(cursor, snapUp(item.startTime + item.duration))
  }
  if (cursor + duration <= settings.dayEnd) return { startTime: cursor, fits: true }
  return { startTime: Math.min(cursor, 24 * 60 - SLOT_MINUTES), fits: false }
}

function snapUp(minutes: Minutes): Minutes {
  return Math.ceil(minutes / SLOT_MINUTES) * SLOT_MINUTES
}
