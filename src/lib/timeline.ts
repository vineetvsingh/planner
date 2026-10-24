import { itemsOnDay, SLOT_MINUTES } from "@/lib/schedule"
import type { ISODate, Minutes, Plan, ScheduledItem } from "@/lib/types"

export const DAY_MINUTES = 24 * 60

export function snapToSlot(minutes: Minutes): Minutes {
  return Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export interface LaneInfo {
  lane: number
  lanes: number
}

/**
 * Assigns overlapping items to side-by-side lanes, like a calendar, so a clash never
 * hides one activity behind another. Items that don't overlap anything get the full width.
 */
export function layoutLanes(items: ScheduledItem[]): Map<string, LaneInfo> {
  const sorted = [...items].sort((a, b) => a.startTime - b.startTime || b.duration - a.duration)
  const result = new Map<string, LaneInfo>()
  let cluster: { id: string; lane: number }[] = []
  let laneEnds: number[] = []
  let clusterEnd = -1

  const flush = () => {
    for (const { id, lane } of cluster) result.set(id, { lane, lanes: laneEnds.length })
    cluster = []
    laneEnds = []
  }

  for (const item of sorted) {
    const end = item.startTime + item.duration
    if (item.startTime >= clusterEnd) flush()
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= item.startTime)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(end)
    } else {
      laneEnds[lane] = end
    }
    cluster.push({ id: item.id, lane })
    clusterEnd = Math.max(clusterEnd, end)
  }
  flush()
  return result
}

export type PlacementStatus = "ok" | "warning" | "invalid"

export interface Placement {
  date: ISODate
  startTime: Minutes
  duration: Minutes
  status: PlacementStatus
  /** Why the placement is flagged; empty when it's fine. */
  message: string
}

/** Item IDs on `date` whose time range intersects [startTime, startTime + duration). */
export function findOverlaps(
  items: ScheduledItem[],
  date: ISODate,
  startTime: Minutes,
  duration: Minutes,
  ignoreId?: string,
): ScheduledItem[] {
  const end = startTime + duration
  return itemsOnDay(items, date).filter(
    (i) => i.id !== ignoreId && i.startTime < end && startTime < i.startTime + i.duration,
  )
}

/**
 * Judges a prospective placement. Running past midnight is rejected because a day's
 * timeline ends there; overlaps and times outside planning hours are allowed but flagged.
 */
export function evaluatePlacement(
  plan: Plan,
  target: { date: ISODate; startTime: Minutes; duration: Minutes; itemId?: string },
): Placement {
  const { date, startTime, duration, itemId } = target
  const end = startTime + duration
  const base = { date, startTime, duration }

  if (end > DAY_MINUTES) {
    return { ...base, status: "invalid", message: "Would run past midnight" }
  }
  const overlaps = findOverlaps(plan.items, date, startTime, duration, itemId)
  if (overlaps.length > 0) {
    const first = plan.activities.find((a) => a.id === overlaps[0].activityId)?.title ?? "another activity"
    const more = overlaps.length > 1 ? ` and ${overlaps.length - 1} more` : ""
    return { ...base, status: "warning", message: `Overlaps ${first}${more}` }
  }
  if (startTime < plan.settings.dayStart || end > plan.settings.dayEnd) {
    return { ...base, status: "warning", message: "Outside planning hours" }
  }
  return { ...base, status: "ok", message: "" }
}
