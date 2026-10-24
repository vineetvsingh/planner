import { useLayoutEffect, useRef } from "react"
import { format, parseISO } from "date-fns"
import { CircleCheck, TriangleAlert } from "lucide-react"

import { PanelHeading } from "@/components/editor/panel-heading"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { formatDistance } from "@/lib/geo"
import { CATEGORIES } from "@/lib/plan-meta"
import { formatClock, formatCurrency, formatDuration } from "@/lib/plan-utils"
import {
  describeConflict,
  suggestSlot,
  type Conflict,
  type DaySummary,
  type PlanAnalysis,
} from "@/lib/schedule-analysis"
import { DAY_MINUTES } from "@/lib/timeline"
import type { ActivityCategory, ISODate, Plan } from "@/lib/types"
import { cn } from "@/lib/utils"
import { usePreferences } from "@/store/preferences-store"

interface PlanSummaryProps {
  plan: Plan
  analysis: PlanAnalysis
  readOnly: boolean
  onShowItem: (itemId: string) => void
  /** Moves the item to its suggested free slot. */
  onFix: (itemId: string) => void
  onOpenSettings: () => void
}

export function PlanSummary({ plan, analysis, readOnly, onShowItem, onFix, onOpenSettings }: PlanSummaryProps) {
  const { dayStart, dayEnd } = plan.settings
  const dayIndex = (date: ISODate) => analysis.days.findIndex((d) => d.date === date)
  const hasItems = plan.items.length > 0

  return (
    <div className="bg-background">
      <PanelHeading title="Plan summary" description="Select an activity to edit it." />
      <div className="space-y-6 p-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Planned" value={formatDuration(analysis.busyMinutes)} />
          <Stat label="Free time" value={formatDuration(analysis.freeMinutes)} />
          <Stat label="Activities" value={String(analysis.activityCount)} />
          <Stat label="Locations" value={String(analysis.locationCount)} />
        </dl>

        <BudgetSection plan={plan} cost={analysis.estimatedCost} readOnly={readOnly} onOpenSettings={onOpenSettings} />

        <ConflictsSection
          plan={plan}
          conflicts={analysis.conflicts}
          hasItems={hasItems}
          readOnly={readOnly}
          dayIndex={dayIndex}
          onShowItem={onShowItem}
          onFix={onFix}
        />

        <section aria-labelledby="summary-days" className="space-y-3">
          <h3 id="summary-days" className="text-sm font-semibold">
            Days
          </h3>
          <ul className="space-y-4">
            {analysis.days.map((day, index) => (
              <DayRow
                key={day.date}
                day={day}
                index={index}
                plan={plan}
                overlaps={analysis.conflicts.filter((c) => c.kind === "overlap" && c.date === day.date)}
              />
            ))}
          </ul>
        </section>

        {hasItems && <CategorySection minutesByCategory={analysis.minutesByCategory} />}

        <p className="text-xs text-muted-foreground">
          Free time counts planning hours, {formatClock(dayStart)}–
          {dayEnd === DAY_MINUTES ? "midnight" : formatClock(dayEnd)} each day. Overlapping activities count once.
        </p>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function BudgetSection({
  plan,
  cost,
  readOnly,
  onOpenSettings,
}: {
  plan: Plan
  cost: number
  readOnly: boolean
  onOpenSettings: () => void
}) {
  const { budget, currency } = plan.settings
  const hasBudget = budget !== undefined
  const used = !hasBudget ? 0 : budget === 0 ? (cost > 0 ? 100 : 0) : Math.round((cost / budget) * 100)
  const over = hasBudget && cost > budget

  return (
    <section aria-labelledby="summary-budget" className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="summary-budget" className="text-sm font-semibold">
          {hasBudget ? "Budget" : "Estimated cost"}
        </h3>
        {hasBudget ? (
          <span
            className={cn(
              "text-xs tabular-nums",
              over ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground",
            )}
          >
            {over
              ? `${formatCurrency(cost - budget, currency)} over`
              : `${formatCurrency(budget - cost, currency)} left`}
          </span>
        ) : (
          !readOnly && (
            <Button variant="link" size="xs" className="h-auto p-0" onClick={onOpenSettings}>
              Set a budget
            </Button>
          )
        )}
      </div>
      <p className="text-base font-semibold tabular-nums">
        {formatCurrency(cost, currency)}
        {hasBudget && (
          <span className="font-normal text-muted-foreground"> of {formatCurrency(budget, currency)}</span>
        )}
      </p>
      {hasBudget && (
        <Progress
          value={Math.min(100, used)}
          aria-label={`${used}% of budget used`}
          className={cn("h-1.5", over && "[&_[data-slot=progress-indicator]]:bg-amber-500")}
        />
      )}
    </section>
  )
}

function ConflictsSection({
  plan,
  conflicts,
  hasItems,
  readOnly,
  dayIndex,
  onShowItem,
  onFix,
}: {
  plan: Plan
  conflicts: Conflict[]
  hasItems: boolean
  readOnly: boolean
  dayIndex: (date: ISODate) => number
  onShowItem: (itemId: string) => void
  onFix: (itemId: string) => void
}) {
  const listRef = useRef<HTMLUListElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  /** After a fix removes a row, focus lands on the row that took its place. */
  const pendingFocus = useRef<number | null>(null)

  useLayoutEffect(() => {
    const index = pendingFocus.current
    if (index === null) return
    pendingFocus.current = null
    const rows = listRef.current?.querySelectorAll<HTMLElement>("[data-conflict-row]")
    const row = rows?.[Math.min(index, rows.length - 1)]
    ;(row?.querySelector<HTMLElement>("button") ?? headingRef.current)?.focus()
  }, [conflicts])

  return (
    <section aria-labelledby="summary-conflicts" className="space-y-2">
      <h3
        id="summary-conflicts"
        ref={headingRef}
        tabIndex={-1}
        className="flex items-center gap-2 text-sm font-semibold outline-none"
      >
        Conflicts
        {conflicts.length > 0 && (
          <span className="rounded-full bg-amber-100 px-1.5 text-xs font-medium tabular-nums text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {conflicts.length}
          </span>
        )}
      </h3>
      {conflicts.length === 0 ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          {hasItems ? "No overlaps, and everything fits inside planning hours." : "Nothing scheduled yet."}
        </p>
      ) : (
        <ul ref={listRef} className="space-y-2">
          {conflicts.map((conflict, index) => (
            <ConflictRow
              key={conflict.key}
              plan={plan}
              conflict={conflict}
              dayNumber={(date) => dayIndex(date) + 1}
              readOnly={readOnly}
              onShowItem={onShowItem}
              onFix={(itemId) => {
                pendingFocus.current = index
                onFix(itemId)
              }}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function ConflictRow({
  plan,
  conflict,
  dayNumber,
  readOnly,
  onShowItem,
  onFix,
}: {
  plan: Plan
  conflict: Conflict
  dayNumber: (date: ISODate) => number
  readOnly: boolean
  onShowItem: (itemId: string) => void
  onFix: (itemId: string) => void
}) {
  const { title, detail } = describeConflict(plan, conflict)
  // For a clash, move the later activity: pushing things back is the usual fix.
  const target = conflict.itemIds.at(-1)!
  const targetTitle = plan.activities.find(
    (a) => a.id === plan.items.find((i) => i.id === target)?.activityId,
  )?.title
  const suggestion = readOnly ? null : suggestSlot(plan, target)
  const where = suggestion
    ? suggestion.date === conflict.date
      ? formatClock(suggestion.startTime)
      : `Day ${dayNumber(suggestion.date)}, ${formatClock(suggestion.startTime)}`
    : ""

  return (
    <li
      data-conflict-row
      className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40"
    >
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium text-amber-950 dark:text-amber-100">{title}</p>
          <p className="text-xs tabular-nums text-amber-900/80 dark:text-amber-200/80">
            Day {dayNumber(conflict.date)} · {detail}
          </p>
          {!readOnly && (
            <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
              {suggestion
                ? `Suggestion: move ${targetTitle} to ${where}.`
                : "No free slot nearby. Shorten or remove something, or widen your planning hours."}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {suggestion && (
              <Button
                size="xs"
                onClick={() => onFix(target)}
                aria-label={`Move ${targetTitle} to ${where}`}
              >
                Apply
              </Button>
            )}
            <Button size="xs" variant="outline" className="bg-background" onClick={() => onShowItem(target)}>
              Show
            </Button>
          </div>
        </div>
      </div>
    </li>
  )
}

function DayRow({
  day,
  index,
  plan,
  overlaps,
}: {
  day: DaySummary
  index: number
  plan: Plan
  overlaps: Conflict[]
}) {
  const { dayStart, dayEnd, currency } = plan.settings
  const unit = usePreferences((s) => s.distanceUnit)
  const windowLength = Math.max(1, dayEnd - dayStart)
  const longest = day.gaps.reduce<DaySummary["gaps"][number] | null>(
    (best, gap) => (!best || gap.end - gap.start > best.end - best.start ? gap : best),
    null,
  )
  const segment = (start: number, end: number) => {
    const from = Math.max(start, dayStart)
    const to = Math.min(end, dayEnd)
    if (to <= from) return null
    return { left: `${((from - dayStart) / windowLength) * 100}%`, width: `${((to - from) / windowLength) * 100}%` }
  }

  return (
    <li className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate font-medium">
          Day {index + 1}{" "}
          <span className="font-normal text-muted-foreground">· {format(parseISO(day.date), "EEE, MMM d")}</span>
        </span>
        {day.conflictCount > 0 && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
            <TriangleAlert className="size-3" aria-hidden />
            {day.conflictCount} {day.conflictCount === 1 ? "conflict" : "conflicts"}
          </span>
        )}
      </div>
      {/* Planning hours left to right: filled where something is scheduled, amber where things clash. */}
      <div className="relative h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        {day.busy.map((b) => {
          const style = segment(b.start, b.end)
          return style && <span key={b.start} className="absolute inset-y-0 bg-foreground/30" style={style} />
        })}
        {overlaps.map((c) => {
          const style = segment(c.start, c.end)
          return style && <span key={c.key} className="absolute inset-y-0 bg-amber-500" style={style} />
        })}
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">
        {day.itemCount === 0
          ? "Nothing planned"
          : `${formatDuration(day.busyMinutes)} planned · ${formatDuration(day.freeMinutes)} free`}
        {day.cost > 0 && ` · ${formatCurrency(day.cost, currency)}`}
        {day.distanceKm > 0 && ` · ≈ ${formatDistance(day.distanceKm, unit)}`}
      </p>
      {day.itemCount > 0 && longest && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Longest free stretch {formatClock(longest.start)}–
          {longest.end === DAY_MINUTES ? "midnight" : formatClock(longest.end)} (
          {formatDuration(longest.end - longest.start)})
        </p>
      )}
    </li>
  )
}

function CategorySection({ minutesByCategory }: { minutesByCategory: Partial<Record<ActivityCategory, number>> }) {
  const entries = (Object.entries(minutesByCategory) as [ActivityCategory, number][])
    .filter(([, minutes]) => minutes > 0)
    .sort((a, b) => b[1] - a[1])
  const total = entries.reduce((sum, [, minutes]) => sum + minutes, 0)
  if (total === 0) return null

  return (
    <section aria-labelledby="summary-categories" className="space-y-3">
      <h3 id="summary-categories" className="text-sm font-semibold">
        Time by category
      </h3>
      <div className="flex h-2 gap-px overflow-hidden rounded-full" aria-hidden>
        {entries.map(([category, minutes]) => (
          <span key={category} className={CATEGORIES[category].bar} style={{ width: `${(minutes / total) * 100}%` }} />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {entries.map(([category, minutes]) => (
          <li key={category} className="flex items-center gap-2">
            <span className={cn("size-2 shrink-0 rounded-full", CATEGORIES[category].bar)} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{CATEGORIES[category].label}</span>
            <span className="tabular-nums text-muted-foreground">{formatDuration(minutes)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
