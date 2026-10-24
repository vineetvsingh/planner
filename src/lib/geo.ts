import { getLocation } from "@/lib/plan-utils"
import { itemsOnDay } from "@/lib/schedule"
import type { Activity, ISODate, Location, Plan, Preferences, ScheduledItem } from "@/lib/types"

/**
 * Map units (0–100 across the sample map) to kilometres. Calibrated on Belém Tower to
 * Praça do Comércio, about 6.5 km apart in a straight line.
 */
const KM_PER_UNIT = 0.13
const KM_PER_MILE = 1.609344

export type DistanceUnit = Preferences["distanceUnit"]

export function distanceKm(a: Location, b: Location): number {
  return Math.hypot(a.x - b.x, a.y - b.y) * KM_PER_UNIT
}

export function formatDistance(km: number, unit: DistanceUnit): string {
  const value = unit === "mi" ? km / KM_PER_MILE : km
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${unit}`
}

export interface RouteStop {
  item: ScheduledItem
  activity: Activity
  location: Location
  /** 1-based position among the day's stops that have a place. */
  number: number
}

export interface RouteLeg {
  from: RouteStop
  to: RouteStop
  km: number
}

export interface DayRoute {
  date: ISODate
  stops: RouteStop[]
  /** Moves between different places; staying put isn't a leg. */
  legs: RouteLeg[]
  totalKm: number
  /** Scheduled activities with no place, so they can't be drawn. */
  unplaced: { item: ScheduledItem; activity: Activity }[]
}

/** A day's activities in itinerary order, as stops on the map. */
export function dayRoute(plan: Plan, date: ISODate): DayRoute {
  const activities = new Map(plan.activities.map((a) => [a.id, a]))
  const stops: RouteStop[] = []
  const unplaced: DayRoute["unplaced"] = []
  for (const item of itemsOnDay(plan.items, date)) {
    const activity = activities.get(item.activityId)
    if (!activity) continue
    const location = getLocation(activity.locationId)
    if (location) stops.push({ item, activity, location, number: stops.length + 1 })
    else unplaced.push({ item, activity })
  }
  const legs: RouteLeg[] = []
  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1]
    const to = stops[i]
    if (from.location.id !== to.location.id) legs.push({ from, to, km: distanceKm(from.location, to.location) })
  }
  return { date, stops, legs, totalKm: legs.reduce((sum, l) => sum + l.km, 0), unplaced }
}

/** The part of the 0–100 map space that is drawn; trims empty margins around the city. */
export const MAP_VIEW = { x: 0, y: 2, width: 92, height: 88 }

/**
 * Pushes points apart until none are closer than `minSeparation`, so nearby places (or one
 * place visited on several days) stay readable. Mutates the points. Deterministic, so
 * markers don't jump around between renders.
 */
export function separatePoints(points: { x: number; y: number }[], minSeparation: number) {
  for (let pass = 0; pass < 40; pass++) {
    let moved = false
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i]
        const b = points[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        let distance = Math.hypot(dx, dy)
        if (distance >= minSeparation) continue
        if (distance < 0.01) [dx, dy, distance] = [1, 0, 1]
        const push = (minSeparation - distance) / 2
        a.x -= (dx / distance) * push
        a.y -= (dy / distance) * push
        b.x += (dx / distance) * push
        b.y += (dy / distance) * push
        moved = true
      }
    }
    if (!moved) return
  }
}
