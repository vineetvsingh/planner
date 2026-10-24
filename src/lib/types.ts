/** ISO calendar date, e.g. "2026-11-07". */
export type ISODate = string

/** Minutes after midnight, e.g. 9:30 → 570. */
export type Minutes = number

export type PlanType = "trip" | "event" | "daily" | "project" | "study"

export type PlanStatus = "draft" | "planning" | "ready"

export type ActivityCategory =
  | "sight"
  | "food"
  | "travel"
  | "activity"
  | "rest"
  | "work"

export type ViewMode = "timeline" | "list" | "map"

export interface Location {
  id: string
  name: string
  /** Position on the sample map illustration, 0–100 on each axis. */
  x: number
  y: number
}

export interface Activity {
  id: string
  title: string
  category: ActivityCategory
  /** Default duration in minutes. */
  duration: Minutes
  locationId?: string
  /** Estimated cost in the plan's currency. */
  cost?: number
  notes?: string
  /** Library activity this was copied from, if any. */
  sourceId?: string
}

export interface ScheduledItem {
  id: string
  /** References an activity in `Plan.activities`. */
  activityId: string
  date: ISODate
  startTime: Minutes
  duration: Minutes
  /** Position within its day, used for list ordering. */
  order: number
}

export interface PlanSettings {
  /** Planning window for each day. */
  dayStart: Minutes
  dayEnd: Minutes
  budget?: number
  currency: string
}

export interface Plan {
  id: string
  name: string
  type: PlanType
  startDate: ISODate
  endDate: ISODate
  status: PlanStatus
  archived: boolean
  settings: PlanSettings
  /** Activities copied into this plan, so it stays self-contained when exported or shared. */
  activities: Activity[]
  items: ScheduledItem[]
  createdAt: number
  updatedAt: number
}

export interface Preferences {
  timeFormat: "12h" | "24h"
  /** Pixel height of one hour on the timeline. */
  hourHeight: number
  distanceUnit: "km" | "mi"
  defaultView: ViewMode
}
