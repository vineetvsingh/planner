import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameMonth,
  isSameYear,
  parseISO,
} from "date-fns"

import type { ISODate, Minutes, Plan } from "@/lib/types"
import { SAMPLE_LOCATIONS } from "@/lib/sample-data"

export const MAX_PLAN_DAYS = 31
export const PLAN_NAME_MAX = 60

export function toISODate(date: Date): ISODate {
  return format(date, "yyyy-MM-dd")
}

export function planDays(plan: Pick<Plan, "startDate" | "endDate">): ISODate[] {
  const start = parseISO(plan.startDate)
  const count = dayCount(plan)
  return Array.from({ length: count }, (_, i) => toISODate(addDays(start, i)))
}

export function dayCount(plan: Pick<Plan, "startDate" | "endDate">): number {
  return differenceInCalendarDays(parseISO(plan.endDate), parseISO(plan.startDate)) + 1
}

/** "Nov 7 – 9, 2026", "Nov 30 – Dec 2, 2026", or "Nov 7, 2026" for one day. */
export function formatDateRange(startDate: ISODate, endDate: ISODate): string {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  if (startDate === endDate) return format(start, "MMM d, yyyy")
  if (!isSameYear(start, end)) {
    return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`
  }
  if (isSameMonth(start, end)) {
    return `${format(start, "MMM d")} – ${format(end, "d, yyyy")}`
  }
  return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`
}

export function formatDuration(minutes: Minutes): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function formatClock(minutes: Minutes, timeFormat: "12h" | "24h" = "24h"): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const mm = String(m).padStart(2, "0")
  if (timeFormat === "24h") return `${String(h).padStart(2, "0")}:${mm}`
  const suffix = h < 12 ? "am" : "pm"
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mm}${suffix}`
}

export function getLocation(id: string | undefined) {
  return id ? SAMPLE_LOCATIONS.find((l) => l.id === id) : undefined
}

export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

/** Parses an optional, non-negative money amount. `null` means invalid input. */
export function parseCost(text: string): number | undefined | null {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  const value = Number(trimmed)
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null
}
