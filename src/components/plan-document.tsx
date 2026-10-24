import { useState } from "react"
import { format, parseISO } from "date-fns"

import { MapArt } from "@/components/editor/map-art"
import { dayRoute, formatDistance, MAP_VIEW, separatePoints, type DayRoute, type DistanceUnit } from "@/lib/geo"
import { CATEGORIES, dayColor, PLAN_STATUSES, PLAN_TYPES } from "@/lib/plan-meta"
import { formatClock, formatCurrency, formatDateRange, formatDuration, getLocation } from "@/lib/plan-utils"
import { analyzePlan, describeConflict } from "@/lib/schedule-analysis"
import { itemsOnDay } from "@/lib/schedule"
import { DAY_MINUTES } from "@/lib/timeline"
import type { Plan } from "@/lib/types"
import { cn } from "@/lib/utils"

interface PlanDocumentProps {
  plan: Plan
  showMaps: boolean
  showNotes: boolean
  distanceUnit: DistanceUnit
}

/**
 * The whole plan as a read-only document: what gets printed or saved as PDF, and what
 * people opening a share link see. Laid out to paginate cleanly on paper.
 */
export function PlanDocument({ plan, showMaps, showNotes, distanceUnit }: PlanDocumentProps) {
  const analysis = analyzePlan(plan)
  const activities = new Map(plan.activities.map((a) => [a.id, a]))
  const { budget, currency } = plan.settings
  const [madeOn] = useState(() => new Date())

  return (
    <article className="mx-auto max-w-4xl space-y-8 rounded-xl border bg-card p-6 text-card-foreground shadow-sm sm:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <header className="space-y-1 border-b pb-6">
        <p className="text-sm text-muted-foreground">
          {PLAN_TYPES[plan.type].label} · {PLAN_STATUSES[plan.status].label}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{plan.name}</h1>
        <p className="text-muted-foreground">
          {formatDateRange(plan.startDate, plan.endDate)} · {analysis.days.length}{" "}
          {analysis.days.length === 1 ? "day" : "days"}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4 print:grid-cols-4">
        <Fact label="Activities" value={String(analysis.activityCount)} />
        <Fact label="Planned" value={formatDuration(analysis.busyMinutes)} />
        <Fact label="Free time" value={formatDuration(analysis.freeMinutes)} />
        <Fact
          label={budget !== undefined ? "Cost / budget" : "Estimated cost"}
          value={
            formatCurrency(analysis.estimatedCost, currency) +
            (budget !== undefined ? ` / ${formatCurrency(budget, currency)}` : "")
          }
        />
      </dl>

      {analysis.conflicts.length > 0 && (
        <section aria-labelledby="doc-conflicts" className="rounded-lg border border-amber-300 p-4 text-sm print:break-inside-avoid">
          <h2 id="doc-conflicts" className="font-semibold">
            {analysis.conflicts.length} scheduling {analysis.conflicts.length === 1 ? "conflict" : "conflicts"}
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {analysis.conflicts.map((conflict) => {
              const { title, detail } = describeConflict(plan, conflict)
              const day = analysis.days.findIndex((d) => d.date === conflict.date) + 1
              return (
                <li key={conflict.key}>
                  {title} <span className="text-muted-foreground">(Day {day} · {detail})</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {analysis.days.map((day, index) => {
        const items = itemsOnDay(plan.items, day.date)
        const route = dayRoute(plan, day.date)
        const stopNumber = new Map(route.stops.map((s) => [s.item.id, s.number]))
        const withMap = showMaps && route.stops.length > 0
        return (
          <section key={day.date} aria-labelledby={`doc-day-${day.date}`} className="space-y-3 print:break-inside-avoid">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-2">
              <h2 id={`doc-day-${day.date}`} className="text-lg font-semibold">
                Day {index + 1}{" "}
                <span className="font-normal text-muted-foreground">· {format(parseISO(day.date), "EEEE, MMMM d")}</span>
              </h2>
              {items.length > 0 && (
                <p className="text-sm tabular-nums text-muted-foreground">
                  {formatDuration(day.busyMinutes)} planned · {formatDuration(day.freeMinutes)} free
                  {day.cost > 0 && ` · ${formatCurrency(day.cost, currency)}`}
                  {day.distanceKm > 0 && ` · ≈ ${formatDistance(day.distanceKm, distanceUnit)}`}
                </p>
              )}
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing planned.</p>
            ) : (
              <div
                className={cn(
                  "grid gap-6",
                  withMap && "md:grid-cols-[minmax(0,1fr)_15rem] print:grid-cols-[minmax(0,1fr)_14rem]",
                )}
              >
                <table className="w-full text-sm">
                  <thead className="sr-only">
                    <tr>
                      <th scope="col">Time</th>
                      <th scope="col">Activity</th>
                      <th scope="col">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item) => {
                      const activity = activities.get(item.activityId)
                      if (!activity) return null
                      const location = getLocation(activity.locationId)
                      const number = stopNumber.get(item.id)
                      const end = (item.startTime + item.duration) % DAY_MINUTES
                      return (
                        <tr key={item.id} className="align-top">
                          <td className="w-28 py-2 pr-3 tabular-nums whitespace-nowrap text-muted-foreground">
                            {formatClock(item.startTime)}–{formatClock(end)}
                          </td>
                          <td className="py-2 pr-3">
                            <p className="font-medium">
                              {activity.title}
                              {analysis.conflictsByItem.has(item.id) && (
                                <span className="ml-1.5 text-xs font-normal text-amber-700 dark:text-amber-400">
                                  (conflict)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {CATEGORIES[activity.category].label} · {formatDuration(item.duration)}
                              {location && (
                                <>
                                  {" · "}
                                  {withMap && number !== undefined && (
                                    <span
                                      className="mr-1 inline-grid size-4 place-items-center rounded-full align-[-0.15em] text-[0.6rem] font-semibold text-white"
                                      style={{ background: dayColor(index) }}
                                      aria-label={`Stop ${number}`}
                                    >
                                      {number}
                                    </span>
                                  )}
                                  {location.name}
                                </>
                              )}
                            </p>
                            {showNotes && activity.notes && (
                              <p className="mt-1 text-xs whitespace-pre-line">{activity.notes}</p>
                            )}
                          </td>
                          <td className="w-16 py-2 text-right tabular-nums text-muted-foreground">
                            {activity.cost ? formatCurrency(activity.cost, currency) : ""}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {withMap && <RouteMap route={route} dayIndex={index} />}
              </div>
            )}
          </section>
        )
      })}

      <footer className="border-t pt-4 text-xs text-muted-foreground">
        Made with Plan Composer · {format(madeOn, "MMM d, yyyy")}. Distances are straight-line estimates.
      </footer>
    </article>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-base font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

/** A small, static map of one day's route, numbered to match the table. */
function RouteMap({ route, dayIndex }: { route: DayRoute; dayIndex: number }) {
  const color = dayColor(dayIndex)
  const markers = route.stops
    .filter((s, i) => route.stops.findIndex((o) => o.location.id === s.location.id) === i)
    .map((s) => ({
      locationId: s.location.id,
      label: route.stops.filter((o) => o.location.id === s.location.id).map((o) => o.number).join("·"),
      x: s.location.x,
      y: s.location.y,
    }))
  separatePoints(markers, 5)
  const at = (locationId: string) => markers.find((m) => m.locationId === locationId)!

  return (
    <svg
      viewBox={`${MAP_VIEW.x} ${MAP_VIEW.y} ${MAP_VIEW.width} ${MAP_VIEW.height}`}
      className="w-full self-start overflow-hidden rounded-md border"
      role="img"
      aria-label={`Map of the day's route: ${route.stops.map((s) => s.location.name).join(", then ")}`}
    >
      <MapArt />
      {route.legs.map((leg) => {
        const a = at(leg.from.location.id)
        const b = at(leg.to.location.id)
        return (
          <line key={leg.from.item.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth="0.9" strokeLinecap="round" />
        )
      })}
      {markers.map((m) => (
        <g key={m.locationId}>
          <circle cx={m.x} cy={m.y} r={m.label.length > 1 ? 3 : 2.4} fill={color} stroke="white" strokeWidth="0.6" />
          <text
            x={m.x}
            y={m.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            fontSize={m.label.length > 1 ? 2.2 : 2.6}
            fontWeight="600"
          >
            {m.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
