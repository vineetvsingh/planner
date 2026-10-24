import { addDays, nextFriday, startOfToday } from "date-fns"
import { nanoid } from "nanoid"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { readPlan } from "@/lib/plan-file"
import { toISODate } from "@/lib/plan-utils"
import { SAMPLE_ACTIVITIES } from "@/lib/sample-data"
import { findFreeSlot, normalizeOrder, type SlotResult } from "@/lib/schedule"
import type { Activity, ISODate, Minutes, Plan, PlanSettings, PlanType, ScheduledItem } from "@/lib/types"
import { reportingStorage, setAsideDamagedData, useRecoveryNotice } from "@/store/save-status"

export const DEFAULT_SETTINGS: PlanSettings = {
  dayStart: 8 * 60,
  dayEnd: 22 * 60,
  currency: "USD",
}

export interface PlanInput {
  name: string
  type: PlanType
  startDate: ISODate
  endDate: ISODate
  settings: PlanSettings
}

export type PlanPatch = Partial<Pick<Plan, "name" | "type" | "startDate" | "endDate" | "status" | "settings">>

export type ActivityTemplate = Omit<Activity, "id">

export interface ItemPatch {
  item?: Partial<Pick<ScheduledItem, "date" | "startTime" | "duration">>
  activity?: Partial<ActivityTemplate>
}

export interface AddResult extends SlotResult {
  itemId: string
}

/** The editable content of a plan; what undo and redo swap in and out. */
interface Snapshot {
  activities: Activity[]
  items: ScheduledItem[]
}

interface History {
  past: Snapshot[]
  future: Snapshot[]
  /** Consecutive edits sharing a key (e.g. typing in one field) collapse into one undo step. */
  lastKey?: string
  lastAt?: number
}

const HISTORY_LIMIT = 100
const COALESCE_MS = 1500

interface PlansState {
  plans: Plan[]
  /** Per-plan undo history. Kept in memory only, so it resets on reload. */
  history: Record<string, History>
  createPlan: (input: PlanInput) => string
  createSamplePlan: () => string
  updatePlan: (id: string, patch: PlanPatch) => void
  duplicatePlan: (id: string) => string | undefined
  setArchived: (id: string, archived: boolean) => void
  deletePlan: (id: string) => void
  restorePlan: (plan: Plan) => void
  /** Adds copies of plans from a file or share link, with fresh IDs. Returns the new IDs. */
  importPlans: (plans: Plan[]) => string[]

  /** Schedules a copy of `template` on `date`, at `startTime` or the first free slot. */
  addActivity: (planId: string, template: ActivityTemplate, date: ISODate, startTime?: Minutes) => AddResult
  updateItem: (planId: string, itemId: string, patch: ItemPatch, coalesceKey?: string) => void
  removeItem: (planId: string, itemId: string) => void
  duplicateItem: (planId: string, itemId: string) => AddResult | undefined
  undo: (planId: string) => boolean
  redo: (planId: string) => boolean
}

/** Items scheduled outside the plan's dates, which a date change would drop. */
export function itemsOutsideRange(items: ScheduledItem[], startDate: ISODate, endDate: ISODate) {
  return items.filter((item) => item.date < startDate || item.date > endDate)
}

function buildSamplePlan(): Plan {
  const friday = nextFriday(startOfToday())
  const [d1, d2, d3] = [0, 1, 2].map((i) => toISODate(addDays(friday, i)))
  const used = [
    "act-arrive", "act-alfama-walk", "act-miradouro", "act-fado",
    "act-jeronimos", "act-pasteis", "act-belem", "act-lxfactory", "act-timeout", "act-bairro",
    "act-castle", "act-tram28", "act-airport",
  ]
  const activities = SAMPLE_ACTIVITIES.filter((a) => used.includes(a.id)).map((a) => ({
    ...a,
    id: nanoid(),
    sourceId: a.id,
  }))
  const schedule: [ISODate, string, number, number?][] = [
    [d1, "act-arrive", 14 * 60],
    [d1, "act-alfama-walk", 16 * 60],
    [d1, "act-miradouro", 18 * 60],
    [d1, "act-fado", 20 * 60],
    [d2, "act-jeronimos", 10 * 60],
    // Deliberately overlaps the monastery visit so the sample shows a conflict.
    [d2, "act-pasteis", 11 * 60 + 15],
    [d2, "act-belem", 12 * 60],
    [d2, "act-lxfactory", 14 * 60 + 30],
    [d2, "act-bairro", 20 * 60],
    [d3, "act-castle", 10 * 60],
    [d3, "act-tram28", 12 * 60 + 30],
    [d3, "act-timeout", 13 * 60 + 30],
    [d3, "act-airport", 17 * 60],
  ]
  const order: Record<ISODate, number> = {}
  const items: ScheduledItem[] = schedule.map(([date, sourceId, startTime]) => {
    const activity = activities.find((a) => a.sourceId === sourceId)!
    order[date] = (order[date] ?? -1) + 1
    return { id: nanoid(), activityId: activity.id, date, startTime, duration: activity.duration, order: order[date] }
  })
  const now = Date.now()
  return {
    id: nanoid(),
    name: "Weekend in Lisbon",
    type: "trip",
    startDate: d1,
    endDate: d3,
    status: "planning",
    archived: false,
    settings: { dayStart: 8 * 60, dayEnd: 23 * 60, currency: "EUR", budget: 400 },
    activities,
    items,
    createdAt: now,
    updatedAt: now,
  }
}

export const usePlansStore = create<PlansState>()(
  persist((set, get) => {
    /**
     * Applies an undoable change to a plan's activities and items. Archived plans are
     * read-only, so edits to them are ignored.
     */
    function edit(
      planId: string,
      recipe: (snapshot: Snapshot) => Snapshot | undefined,
      coalesceKey?: string,
    ) {
      set((s) => {
        const plan = s.plans.find((p) => p.id === planId)
        if (!plan || plan.archived) return s
        const before: Snapshot = { activities: plan.activities, items: plan.items }
        const after = recipe(before)
        if (!after) return s
        const now = Date.now()
        const history = s.history[planId] ?? { past: [], future: [] }
        const merge = !!coalesceKey && history.lastKey === coalesceKey && now - (history.lastAt ?? 0) < COALESCE_MS
        return {
          plans: s.plans.map((p) =>
            p.id === planId
              ? { ...p, activities: after.activities, items: normalizeOrder(after.items), updatedAt: now }
              : p,
          ),
          history: {
            ...s.history,
            [planId]: {
              past: merge ? history.past : [...history.past, before].slice(-HISTORY_LIMIT),
              future: [],
              lastKey: coalesceKey,
              lastAt: now,
            },
          },
        }
      })
    }

    function travel(planId: string, direction: "undo" | "redo"): boolean {
      const plan = get().plans.find((p) => p.id === planId)
      const history = get().history[planId]
      const source = direction === "undo" ? history?.past : history?.future
      if (!plan || plan.archived || !history || !source?.length) return false
      const target = source[source.length - 1]
      const current: Snapshot = { activities: plan.activities, items: plan.items }
      const remaining = source.slice(0, -1)
      set((s) => ({
        plans: s.plans.map((p) => (p.id === planId ? { ...p, ...target, updatedAt: Date.now() } : p)),
        history: {
          ...s.history,
          [planId]:
            direction === "undo"
              ? { past: remaining, future: [...history.future, current] }
              : { past: [...history.past, current], future: remaining },
        },
      }))
      return true
    }

    function requirePlan(planId: string): Plan {
      const plan = get().plans.find((p) => p.id === planId)
      if (!plan) throw new Error(`Plan ${planId} not found`)
      return plan
    }

    function withoutHistory(history: Record<string, History>, planId: string) {
      const { [planId]: _removed, ...rest } = history
      return rest
    }

    return {
      plans: [],
      history: {},

      createPlan: (input) => {
        const now = Date.now()
        const plan: Plan = {
          id: nanoid(),
          ...input,
          name: input.name.trim(),
          status: "draft",
          archived: false,
          activities: [],
          items: [],
          createdAt: now,
          updatedAt: now,
        }
        set((s) => ({ plans: [plan, ...s.plans] }))
        return plan.id
      },

      createSamplePlan: () => {
        const plan = buildSamplePlan()
        set((s) => ({ plans: [plan, ...s.plans] }))
        return plan.id
      },

      updatePlan: (id, patch) =>
        set((s) => {
          let datesChanged = false
          const plans = s.plans.map((p) => {
            if (p.id !== id) return p
            const next = { ...p, ...patch, updatedAt: Date.now() }
            if (patch.name !== undefined) next.name = patch.name.trim()
            if (next.startDate !== p.startDate || next.endDate !== p.endDate) {
              datesChanged = true
              const dropped = new Set(itemsOutsideRange(p.items, next.startDate, next.endDate).map((i) => i.id))
              next.items = p.items.filter((i) => !dropped.has(i.id))
              const kept = new Set(next.items.map((i) => i.activityId))
              next.activities = p.activities.filter((a) => kept.has(a.id))
            }
            return next
          })
          // Undo steps could reintroduce days that no longer exist, so start fresh.
          return { plans, history: datesChanged ? withoutHistory(s.history, id) : s.history }
        }),

      duplicatePlan: (id) => {
        const source = get().plans.find((p) => p.id === id)
        if (!source) return undefined
        const now = Date.now()
        const copy: Plan = {
          ...structuredClone(source),
          id: nanoid(),
          name: `${source.name} (copy)`,
          archived: false,
          status: "draft",
          items: source.items.map((i) => ({ ...i, id: nanoid() })),
          createdAt: now,
          updatedAt: now,
        }
        set((s) => {
          const index = s.plans.findIndex((p) => p.id === id)
          const plans = [...s.plans]
          plans.splice(index + 1, 0, copy)
          return { plans }
        })
        return copy.id
      },

      setArchived: (id, archived) =>
        set((s) => ({
          plans: s.plans.map((p) => (p.id === id ? { ...p, archived, updatedAt: Date.now() } : p)),
        })),

      deletePlan: (id) =>
        set((s) => ({ plans: s.plans.filter((p) => p.id !== id), history: withoutHistory(s.history, id) })),

      restorePlan: (plan) =>
        set((s) => (s.plans.some((p) => p.id === plan.id) ? s : { plans: [plan, ...s.plans] })),

      importPlans: (incoming) => {
        const now = Date.now()
        const copies = incoming.map((plan) => ({ ...plan, id: nanoid(), archived: false, createdAt: now, updatedAt: now }))
        set((s) => ({ plans: [...copies, ...s.plans] }))
        return copies.map((p) => p.id)
      },

      addActivity: (planId, template, date, startTime) => {
        const plan = requirePlan(planId)
        const slot =
          startTime === undefined
            ? findFreeSlot(plan.items, date, template.duration, plan.settings)
            : { startTime, fits: true }
        const activity: Activity = { ...template, id: nanoid() }
        const itemId = nanoid()
        edit(planId, (snap) => ({
          activities: [...snap.activities, activity],
          items: [
            ...snap.items,
            { id: itemId, activityId: activity.id, date, startTime: slot.startTime, duration: template.duration, order: 0 },
          ],
        }))
        return { itemId, ...slot }
      },

      updateItem: (planId, itemId, patch, coalesceKey) =>
        edit(
          planId,
          (snap) => {
            const item = snap.items.find((i) => i.id === itemId)
            if (!item) return undefined
            const items = patch.item
              ? snap.items.map((i) => (i.id === itemId ? { ...i, ...patch.item } : i))
              : snap.items
            // Each scheduled item owns its activity copy, so keep their durations in step.
            const activityPatch: Partial<ActivityTemplate> = {
              ...patch.activity,
              ...(patch.item?.duration !== undefined && { duration: patch.item.duration }),
            }
            const activities =
              Object.keys(activityPatch).length > 0
                ? snap.activities.map((a) => (a.id === item.activityId ? { ...a, ...activityPatch } : a))
                : snap.activities
            return { activities, items }
          },
          coalesceKey,
        ),

      removeItem: (planId, itemId) =>
        edit(planId, (snap) => {
          const item = snap.items.find((i) => i.id === itemId)
          if (!item) return undefined
          const items = snap.items.filter((i) => i.id !== itemId)
          const stillUsed = items.some((i) => i.activityId === item.activityId)
          return {
            items,
            activities: stillUsed ? snap.activities : snap.activities.filter((a) => a.id !== item.activityId),
          }
        }),

      duplicateItem: (planId, itemId) => {
        const plan = requirePlan(planId)
        const item = plan.items.find((i) => i.id === itemId)
        const activity = item && plan.activities.find((a) => a.id === item.activityId)
        if (!item || !activity) return undefined
        const { id: _id, ...template } = activity
        return get().addActivity(planId, { ...template, duration: item.duration }, item.date)
      },

      undo: (planId) => travel(planId, "undo"),
      redo: (planId) => travel(planId, "redo"),
    }
  }, {
    name: "plan-composer",
    version: 1,
    storage: createJSONStorage(() => reportingStorage),
    partialize: (s) => ({ plans: s.plans }),
    // Saved data is untrusted: an older build, a manual edit or a cut-off write can break it.
    // Keep every plan that can be read, repair what can be repaired, and set the original aside.
    merge: (persisted, current) => {
      const raw = (persisted as { plans?: unknown } | undefined)?.plans
      const entries: unknown[] = Array.isArray(raw) ? raw : []
      const plans: Plan[] = []
      let dropped = Array.isArray(raw) || raw === undefined ? 0 : 1
      let repaired = 0
      for (const entry of entries) {
        const result = readPlan(entry)
        if (!result) dropped++
        else {
          if (result.repairs > 0) repaired++
          plans.push(result.plan)
        }
      }
      if (dropped + repaired > 0) {
        const backupKey = setAsideDamagedData("plan-composer", JSON.stringify(persisted))
        if (backupKey) useRecoveryNotice.setState({ notice: { kind: "repaired", backupKey, dropped, repaired } })
      }
      return { ...current, plans }
    },
  }),
)

export function useHistoryState(planId: string) {
  const canUndo = usePlansStore((s) => (s.history[planId]?.past.length ?? 0) > 0)
  const canRedo = usePlansStore((s) => (s.history[planId]?.future.length ?? 0) > 0)
  return { canUndo, canRedo }
}

export function usePlan(id: string | undefined) {
  return usePlansStore((s) => s.plans.find((p) => p.id === id))
}

/** How many undo steps a plan has, used to tell whether a toast's undo is still current. */
export function historyDepth(planId: string): number {
  return usePlansStore.getState().history[planId]?.past.length ?? 0
}

/**
 * Undo for a toast action: only steps back if nothing else changed since, so an old
 * toast can't silently revert a newer edit. Returns false when it declined.
 */
export function undoIfLatest(planId: string, expectedDepth: number): boolean {
  if (historyDepth(planId) !== expectedDepth) return false
  return usePlansStore.getState().undo(planId)
}
