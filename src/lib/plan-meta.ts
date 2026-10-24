import {
  BriefcaseBusiness,
  CalendarDays,
  Coffee,
  Footprints,
  GraduationCap,
  Landmark,
  PartyPopper,
  Plane,
  SquareKanban,
  TramFront,
  Utensils,
  type LucideIcon,
} from "lucide-react"

import type { ActivityCategory, PlanStatus, PlanType } from "@/lib/types"

interface PlanTypeMeta {
  label: string
  description: string
  icon: LucideIcon
  /** Classes for the tinted icon tile. */
  tile: string
}

export const PLAN_TYPES: Record<PlanType, PlanTypeMeta> = {
  trip: {
    label: "Trip",
    description: "Places, meals and travel",
    icon: Plane,
    tile: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  },
  event: {
    label: "Event",
    description: "Sessions, guests and venues",
    icon: PartyPopper,
    tile: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300",
  },
  daily: {
    label: "Daily",
    description: "A routine or busy day",
    icon: CalendarDays,
    tile: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  project: {
    label: "Project",
    description: "Milestones and work blocks",
    icon: SquareKanban,
    tile: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  study: {
    label: "Study",
    description: "Sessions, reviews and breaks",
    icon: GraduationCap,
    tile: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  },
}

export const PLAN_TYPE_ORDER: PlanType[] = ["trip", "event", "daily", "project", "study"]

export const PLAN_STATUSES: Record<PlanStatus, { label: string; dot: string }> = {
  draft: { label: "Draft", dot: "bg-muted-foreground" },
  planning: { label: "Planning", dot: "bg-amber-500" },
  ready: { label: "Ready", dot: "bg-emerald-500" },
}

export const PLAN_STATUS_ORDER: PlanStatus[] = ["draft", "planning", "ready"]

interface CategoryMeta {
  label: string
  icon: LucideIcon
  /** Classes for chips and timeline blocks. */
  chip: string
  /** Border colour marking the category on timeline blocks. */
  accent: string
  /** Solid fill for charts and strips. */
  bar: string
}

export const CATEGORIES: Record<ActivityCategory, CategoryMeta> = {
  sight: {
    label: "Sightseeing",
    icon: Landmark,
    chip: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
    accent: "border-sky-500",
    bar: "bg-sky-500",
  },
  food: {
    label: "Food & drink",
    icon: Utensils,
    chip: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
    accent: "border-orange-500",
    bar: "bg-orange-500",
  },
  travel: {
    label: "Travel",
    icon: TramFront,
    chip: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    accent: "border-slate-500",
    bar: "bg-slate-500",
  },
  activity: {
    label: "Activity",
    icon: Footprints,
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    accent: "border-emerald-500",
    bar: "bg-emerald-500",
  },
  rest: {
    label: "Rest",
    icon: Coffee,
    chip: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
    accent: "border-violet-500",
    bar: "bg-violet-500",
  },
  work: {
    label: "Work",
    icon: BriefcaseBusiness,
    chip: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
    accent: "border-rose-500",
    bar: "bg-rose-500",
  },
}

/** Dark enough for white numbers on top, distinct enough to tell days apart. */
const DAY_COLORS = [
  "oklch(0.5 0.13 245)",
  "oklch(0.48 0.2 295)",
  "oklch(0.5 0.11 165)",
  "oklch(0.55 0.17 45)",
  "oklch(0.5 0.19 15)",
  "oklch(0.5 0.09 195)",
  "oklch(0.47 0.17 265)",
  "oklch(0.52 0.12 85)",
]

export function dayColor(index: number): string {
  return DAY_COLORS[index % DAY_COLORS.length]
}
