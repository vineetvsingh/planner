import { isValid, parseISO } from "date-fns"

import { CATEGORIES, PLAN_STATUSES, PLAN_TYPES } from "@/lib/plan-meta"
import { dayCount, MAX_PLAN_DAYS, PLAN_NAME_MAX } from "@/lib/plan-utils"
import { SAMPLE_LOCATIONS } from "@/lib/sample-data"
import type { Activity, ActivityCategory, Plan, PlanSettings, PlanStatus, PlanType, ScheduledItem } from "@/lib/types"

const FILE_FORMAT = "plan-composer"
const FILE_VERSION = 1
const DAY_MINUTES = 24 * 60

type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v)
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)
const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0
const isDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && isValid(parseISO(v))

function readSettings(raw: unknown): PlanSettings {
  const s = isObject(raw) ? raw : {}
  const dayStart = isNumber(s.dayStart) && s.dayStart >= 0 && s.dayStart < DAY_MINUTES ? Math.round(s.dayStart) : 8 * 60
  const dayEnd = isNumber(s.dayEnd) && s.dayEnd > dayStart && s.dayEnd <= DAY_MINUTES ? Math.round(s.dayEnd) : 22 * 60
  return {
    dayStart,
    dayEnd: Math.max(dayEnd, dayStart + 15),
    budget: isNumber(s.budget) && s.budget >= 0 ? s.budget : undefined,
    currency: typeof s.currency === "string" && /^[A-Z]{3}$/.test(s.currency) ? s.currency : "USD",
  }
}

function readActivity(raw: unknown): Activity | null {
  if (!isObject(raw) || !isText(raw.id) || !isText(raw.title)) return null
  return {
    id: raw.id,
    title: raw.title.trim().slice(0, 120),
    category: (raw.category as string) in CATEGORIES ? (raw.category as ActivityCategory) : "activity",
    duration: isNumber(raw.duration) && raw.duration > 0 ? Math.round(raw.duration) : 60,
    locationId: SAMPLE_LOCATIONS.some((l) => l.id === raw.locationId) ? (raw.locationId as string) : undefined,
    cost: isNumber(raw.cost) && raw.cost >= 0 ? raw.cost : undefined,
    notes: typeof raw.notes === "string" && raw.notes ? raw.notes.slice(0, 2000) : undefined,
    sourceId: typeof raw.sourceId === "string" ? raw.sourceId : undefined,
  }
}

export interface ReadResult {
  plan: Plan
  /** Pieces that were dropped or replaced with defaults because they were unreadable. */
  repairs: number
}

/**
 * Checks untrusted data (storage, an imported file, a share link) and returns a plan the
 * app can safely render. Broken parts are dropped or defaulted rather than failing the
 * whole plan; null means it isn't recognisably a plan at all.
 */
export function readPlan(raw: unknown): ReadResult | null {
  if (!isObject(raw) || !isText(raw.id) || !isDate(raw.startDate) || !isDate(raw.endDate)) return null
  let repairs = 0
  const fix = <T>(ok: boolean, value: T, fallback: T): T => {
    if (!ok) repairs++
    return ok ? value : fallback
  }

  const startDate = raw.startDate
  let endDate = raw.endDate
  const span = dayCount({ startDate, endDate })
  if (span < 1 || span > MAX_PLAN_DAYS) {
    repairs++
    endDate = startDate
  }

  const rawActivities = Array.isArray(raw.activities) ? raw.activities : []
  const activities: Activity[] = []
  for (const a of rawActivities) {
    const activity = readActivity(a)
    if (activity && !activities.some((x) => x.id === activity.id)) activities.push(activity)
    else repairs++
  }

  const rawItems = Array.isArray(raw.items) ? raw.items : []
  const activityIds = new Set(activities.map((a) => a.id))
  const items: ScheduledItem[] = []
  for (const i of rawItems) {
    const ok =
      isObject(i) &&
      isText(i.id) &&
      typeof i.activityId === "string" &&
      activityIds.has(i.activityId) &&
      isDate(i.date) &&
      i.date >= startDate &&
      i.date <= endDate &&
      isNumber(i.startTime) &&
      i.startTime >= 0 &&
      i.startTime < DAY_MINUTES &&
      isNumber(i.duration) &&
      i.duration > 0 &&
      i.duration <= DAY_MINUTES &&
      !items.some((x) => x.id === i.id)
    if (!ok) {
      repairs++
      continue
    }
    items.push({
      id: i.id as string,
      activityId: i.activityId as string,
      date: i.date as string,
      startTime: Math.round(i.startTime as number),
      duration: Math.round(i.duration as number),
      order: isNumber(i.order) ? i.order : items.length,
    })
  }
  // Each scheduled item owns its activity copy; unreferenced copies are leftovers.
  const used = new Set(items.map((i) => i.activityId))
  const kept = activities.filter((a) => used.has(a.id))
  repairs += activities.length - kept.length

  const now = Date.now()
  const plan: Plan = {
    id: raw.id,
    name: fix(isText(raw.name), String(raw.name).trim().slice(0, PLAN_NAME_MAX), "Untitled plan"),
    type: fix((raw.type as string) in PLAN_TYPES, raw.type as PlanType, "trip"),
    startDate,
    endDate,
    status: fix((raw.status as string) in PLAN_STATUSES, raw.status as PlanStatus, "draft"),
    archived: raw.archived === true,
    settings: readSettings(raw.settings),
    activities: kept,
    items,
    createdAt: isNumber(raw.createdAt) ? raw.createdAt : now,
    updatedAt: isNumber(raw.updatedAt) ? raw.updatedAt : now,
  }
  return { plan, repairs }
}

/** A downloadable file holding one plan, or several as a backup. */
export function toPlanFile(plans: Plan[]): string {
  return JSON.stringify({ format: FILE_FORMAT, version: FILE_VERSION, exportedAt: new Date().toISOString(), plans }, null, 2)
}

/** Reads a file made by `toPlanFile`. Throws an Error with a user-facing message when it can't. */
export function fromPlanFile(text: string): ReadResult[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("This file isn't valid JSON.")
  }
  if (!isObject(data) || data.format !== FILE_FORMAT || !Array.isArray(data.plans)) {
    throw new Error("This doesn't look like a Plan Composer file.")
  }
  if (isNumber(data.version) && data.version > FILE_VERSION) {
    throw new Error("This file was made by a newer version of Plan Composer.")
  }
  const results = data.plans.map(readPlan).filter((r): r is ReadResult => r !== null)
  if (results.length === 0) throw new Error("The file doesn't contain any readable plans.")
  return results
}

export function fileNameFor(plan: Plan): string {
  const slug = plan.name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return `${slug || "plan"}.plan.json`
}

/** Saves text as a file through the browser's download flow. */
export function downloadText(text: string, fileName: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  // Give the download a moment to start before releasing the data.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Share links: the plan itself, compressed, in the URL fragment. Fragments never reach a
// server, so sharing uploads nothing.

function toBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream) {
  const output = new Blob([bytes]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(output).arrayBuffer())
}

/** The part after `#` in a share link. */
export async function encodeSharedPlan(plan: Plan): Promise<string> {
  // Archived state is about the owner's dashboard, not the content being shared.
  const payload = JSON.stringify({ v: FILE_VERSION, plan: { ...plan, archived: false } })
  return toBase64Url(await pipe(new TextEncoder().encode(payload), new CompressionStream("deflate-raw")))
}

/** Throws an Error with a user-facing message when the link is damaged. */
export async function decodeSharedPlan(fragment: string): Promise<ReadResult> {
  let data: unknown
  try {
    const bytes = await pipe(fromBase64Url(fragment), new DecompressionStream("deflate-raw"))
    data = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new Error("The link is incomplete or damaged. Ask for it to be sent again.")
  }
  const result = isObject(data) ? readPlan(data.plan) : null
  if (!result) throw new Error("The link doesn't contain a readable plan.")
  return result
}

/** Downloads every plan in one file, for safekeeping or moving to another browser. */
export function downloadBackup(plans: Plan[]) {
  downloadText(toPlanFile(plans), `plan-composer-backup-${new Date().toISOString().slice(0, 10)}.json`)
}
