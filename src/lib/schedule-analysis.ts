import { dayRoute } from "@/lib/geo"
import { formatClock, formatDuration, planDays } from "@/lib/plan-utils"
import { itemsOnDay, SLOT_MINUTES } from "@/lib/schedule"
import { DAY_MINUTES } from "@/lib/timeline"
import type { ActivityCategory, ISODate, Minutes, Plan, ScheduledItem } from "@/lib/types"

export interface Interval {
  start: Minutes
  end: Minutes
}

/** Merges overlapping or touching intervals into a sorted, disjoint list. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start)
  const merged: Interval[] = []
  for (const next of sorted) {
    const last = merged.at(-1)
    if (last && next.start <= last.end) last.end = Math.max(last.end, next.end)
    else merged.push({ ...next })
  }
  return merged
}

/** Total length of `merged` that falls inside [start, end). */
function coveredWithin(merged: Interval[], start: Minutes, end: Minutes): Minutes {
  return merged.reduce((sum, i) => sum + Math.max(0, Math.min(i.end, end) - Math.max(i.start, start)), 0)
}

/** The parts of [start, end) not covered by `merged`. */
function gapsWithin(merged: Interval[], start: Minutes, end: Minutes): Interval[] {
  const gaps: Interval[] = []
  let cursor = start
  for (const busy of merged) {
    if (busy.end <= cursor) continue
    if (busy.start >= end) break
    if (busy.start > cursor) gaps.push({ start: cursor, end: busy.start })
    cursor = Math.max(cursor, busy.end)
  }
  if (cursor < end) gaps.push({ start: cursor, end })
  return gaps.filter((g) => g.end - g.start >= SLOT_MINUTES)
}

export type ConflictKind = "overlap" | "outside-hours" | "past-midnight"

export interface Conflict {
  /** Stable across renders, for React keys and focus handling. */
  key: string
  kind: ConflictKind
  date: ISODate
  /** Overlaps name both items, earlier first; other kinds name one. */
  itemIds: string[]
  /** The clashing span, or the part outside planning hours. */
  start: Minutes
  end: Minutes
}

export interface DaySummary {
  date: ISODate
  itemCount: number
  /** Time with at least one activity running; overlaps count once. */
  busyMinutes: Minutes
  /** Planning hours not covered by any activity. */
  freeMinutes: Minutes
  /** Free stretches inside planning hours, earliest first. */
  gaps: Interval[]
  /** Busy stretches, merged, for drawing a day strip. */
  busy: Interval[]
  cost: number
  conflictCount: number
  /** Straight-line distance between the day's stops, in itinerary order. */
  distanceKm: number
}

export interface PlanAnalysis {
  days: DaySummary[]
  conflicts: Conflict[]
  conflictsByItem: Map<string, Conflict[]>
  activityCount: number
  locationCount: number
  busyMinutes: Minutes
  availableMinutes: Minutes
  freeMinutes: Minutes
  /** Share of planning hours that is scheduled, 0–100. */
  progress: number
  estimatedCost: number
  minutesByCategory: Partial<Record<ActivityCategory, Minutes>>
}

function dayConflicts(items: ScheduledItem[], plan: Plan): Conflict[] {
  const { dayStart, dayEnd } = plan.settings
  const conflicts: Conflict[] = []
  const sorted = [...items].sort((a, b) => a.startTime - b.startTime || a.order - b.order)

  sorted.forEach((a, index) => {
    const aEnd = a.startTime + a.duration
    for (const b of sorted.slice(index + 1)) {
      // Sorted by start, so nothing later can overlap `a` either.
      if (b.startTime >= aEnd) break
      conflicts.push({
        key: `overlap:${a.id}:${b.id}`,
        kind: "overlap",
        date: a.date,
        itemIds: [a.id, b.id],
        start: b.startTime,
        end: Math.min(aEnd, b.startTime + b.duration),
      })
    }
  })

  for (const item of sorted) {
    const end = item.startTime + item.duration
    if (end > DAY_MINUTES) {
      conflicts.push({
        key: `midnight:${item.id}`,
        kind: "past-midnight",
        date: item.date,
        itemIds: [item.id],
        start: DAY_MINUTES,
        end,
      })
    } else if (item.startTime < dayStart || end > dayEnd) {
      const early = item.startTime < dayStart
      conflicts.push({
        key: `hours:${item.id}`,
        kind: "outside-hours",
        date: item.date,
        itemIds: [item.id],
        start: early ? item.startTime : Math.max(item.startTime, dayEnd),
        end: early ? Math.min(end, dayStart) : end,
      })
    }
  }
  return conflicts
}

/**
 * Everything the editor derives from a plan's schedule: per-day busy and free time,
 * gaps, costs and conflicts. Pure, so every view computes the same numbers.
 */
export function analyzePlan(plan: Plan): PlanAnalysis {
  const { dayStart, dayEnd } = plan.settings
  const windowMinutes = Math.max(0, dayEnd - dayStart)
  const activities = new Map(plan.activities.map((a) => [a.id, a]))
  const locationIds = new Set<string>()
  const minutesByCategory: Partial<Record<ActivityCategory, Minutes>> = {}
  const conflicts: Conflict[] = []
  let estimatedCost = 0

  const days = planDays(plan).map((date): DaySummary => {
    const items = itemsOnDay(plan.items, date)
    let cost = 0
    for (const item of items) {
      const activity = activities.get(item.activityId)
      if (!activity) continue
      cost += activity.cost ?? 0
      if (activity.locationId) locationIds.add(activity.locationId)
      minutesByCategory[activity.category] = (minutesByCategory[activity.category] ?? 0) + item.duration
    }
    estimatedCost += cost

    const busy = mergeIntervals(
      items.map((i) => ({ start: i.startTime, end: Math.min(i.startTime + i.duration, DAY_MINUTES) })),
    )
    const found = dayConflicts(items, plan)
    conflicts.push(...found)
    return {
      date,
      itemCount: items.length,
      busyMinutes: busy.reduce((sum, i) => sum + i.end - i.start, 0),
      freeMinutes: windowMinutes - coveredWithin(busy, dayStart, dayEnd),
      gaps: gapsWithin(busy, dayStart, dayEnd),
      busy,
      cost,
      conflictCount: found.length,
      distanceKm: dayRoute(plan, date).totalKm,
    }
  })

  const conflictsByItem = new Map<string, Conflict[]>()
  for (const conflict of conflicts) {
    for (const id of conflict.itemIds) conflictsByItem.set(id, [...(conflictsByItem.get(id) ?? []), conflict])
  }

  const availableMinutes = days.length * windowMinutes
  const freeMinutes = days.reduce((sum, d) => sum + d.freeMinutes, 0)
  return {
    days,
    conflicts,
    conflictsByItem,
    activityCount: plan.items.length,
    locationCount: locationIds.size,
    busyMinutes: days.reduce((sum, d) => sum + d.busyMinutes, 0),
    availableMinutes,
    freeMinutes,
    progress: availableMinutes === 0 ? 0 : Math.round(((availableMinutes - freeMinutes) / availableMinutes) * 100),
    estimatedCost,
    minutesByCategory,
  }
}

export interface SlotSuggestion {
  date: ISODate
  startTime: Minutes
}

/**
 * The free slot inside planning hours closest to where the item is now: same day first,
 * then the nearest other days. Null when the item fits nowhere without a clash.
 */
export function suggestSlot(plan: Plan, itemId: string): SlotSuggestion | null {
  const item = plan.items.find((i) => i.id === itemId)
  if (!item) return null
  const { dayStart, dayEnd } = plan.settings
  const days = planDays(plan)
  const home = days.indexOf(item.date)
  const byDistance = days
    .map((date, index) => ({ date, distance: Math.abs(index - home) }))
    .sort((a, b) => a.distance - b.distance)

  for (const { date } of byDistance) {
    const others = plan.items.filter((i) => i.date === date && i.id !== itemId)
    let best: Minutes | null = null
    const first = Math.ceil(dayStart / SLOT_MINUTES) * SLOT_MINUTES
    for (let start = first; start + item.duration <= dayEnd; start += SLOT_MINUTES) {
      const end = start + item.duration
      if (others.some((o) => o.startTime < end && start < o.startTime + o.duration)) continue
      // On a tie, prefer later: pushing an activity back reads more naturally than pulling it forward.
      if (best === null || Math.abs(start - item.startTime) <= Math.abs(best - item.startTime)) best = start
    }
    if (best !== null) return { date, startTime: best }
  }
  return null
}

/** Numbers for plan cards and other compact summaries. */
export interface PlanStats {
  days: number
  activityCount: number
  locationCount: number
  scheduledMinutes: Minutes
  freeMinutes: Minutes
  progress: number
  estimatedCost: number
  conflictCount: number
}

export function getPlanStats(plan: Plan): PlanStats {
  const analysis = analyzePlan(plan)
  return {
    days: analysis.days.length,
    activityCount: analysis.activityCount,
    locationCount: analysis.locationCount,
    scheduledMinutes: analysis.busyMinutes,
    freeMinutes: analysis.freeMinutes,
    progress: analysis.progress,
    estimatedCost: analysis.estimatedCost,
    conflictCount: analysis.conflicts.length,
  }
}

function titleOf(plan: Plan, itemId: string): string {
  const item = plan.items.find((i) => i.id === itemId)
  return plan.activities.find((a) => a.id === item?.activityId)?.title ?? "An activity"
}

function hoursLabel(plan: Plan): string {
  const { dayStart, dayEnd } = plan.settings
  return `${formatClock(dayStart)}–${dayEnd === DAY_MINUTES ? "midnight" : formatClock(dayEnd)}`
}

/** A headline and supporting detail for listing a conflict across the whole plan. */
export function describeConflict(plan: Plan, conflict: Conflict): { title: string; detail: string } {
  const span = conflict.end - conflict.start
  const [first, second] = conflict.itemIds.map((id) => titleOf(plan, id))
  switch (conflict.kind) {
    case "overlap":
      return {
        title: `${first} overlaps ${second}`,
        detail: `${formatClock(conflict.start)}–${formatClock(conflict.end)} · ${formatDuration(span)} clash`,
      }
    case "past-midnight":
      return { title: `${first} runs past midnight`, detail: `${formatDuration(span)} into the next day` }
    case "outside-hours":
      return {
        title: `${first} is outside planning hours`,
        detail: `${formatDuration(span)} outside ${hoursLabel(plan)}`,
      }
  }
}

/** The same conflict, phrased from one item's point of view. */
export function describeConflictFor(plan: Plan, conflict: Conflict, itemId: string): string {
  const span = formatDuration(conflict.end - conflict.start)
  switch (conflict.kind) {
    case "overlap": {
      const otherId = conflict.itemIds.find((id) => id !== itemId) ?? conflict.itemIds[0]
      const other = plan.items.find((i) => i.id === otherId)
      const when = other ? ` (${formatClock(other.startTime)}–${formatClock((other.startTime + other.duration) % DAY_MINUTES)})` : ""
      return `Overlaps ${titleOf(plan, otherId)}${when} by ${span}.`
    }
    case "past-midnight":
      return `Runs ${span} past midnight.`
    case "outside-hours":
      return `${span} outside your planning hours (${hoursLabel(plan)}).`
  }
}
