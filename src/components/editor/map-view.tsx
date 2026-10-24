import { Fragment, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { MapPinned } from "lucide-react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useElementWidth } from "@/hooks/use-element-width"
import { MapArt } from "@/components/editor/map-art"
import { dayRoute, formatDistance, MAP_VIEW as VIEW, separatePoints, type DayRoute, type RouteStop } from "@/lib/geo"
import { dayColor } from "@/lib/plan-meta"
import { formatClock, planDays } from "@/lib/plan-utils"
import { SAMPLE_LOCATIONS } from "@/lib/sample-data"
import { DAY_MINUTES } from "@/lib/timeline"
import type { ISODate, Location, Plan } from "@/lib/types"
import { cn } from "@/lib/utils"
import { usePreferences } from "@/store/preferences-store"

/** Closest two marker centres may sit on screen, in pixels: a marker's width plus a little air. */
const MARKER_SPACING_PX = 28

interface MapViewProps {
  plan: Plan
  selectedId: string | null
  highlightId: string | null
  onSelect: (itemId: string) => void
}

interface VisibleRoute {
  route: DayRoute
  dayIndex: number
}

interface Marker {
  key: string
  dayIndex: number
  location: Location
  stops: RouteStop[]
  /** Drawn position: the location, nudged apart from nearby markers. */
  x: number
  y: number
}

/** One marker per place per day, separated so each one stays visible. */
function buildMarkers(visible: VisibleRoute[], minSeparation: number): Marker[] {
  const markers: Marker[] = []
  for (const { route, dayIndex } of visible) {
    const byLocation = new Map<string, Marker>()
    for (const stop of route.stops) {
      const existing = byLocation.get(stop.location.id)
      if (existing) existing.stops.push(stop)
      else {
        const marker = {
          key: `${route.date}:${stop.location.id}`,
          dayIndex,
          location: stop.location,
          stops: [stop],
          x: stop.location.x,
          y: stop.location.y,
        }
        byLocation.set(stop.location.id, marker)
        markers.push(marker)
      }
    }
  }
  separatePoints(markers, minSeparation)
  return markers
}

export function MapView({ plan, selectedId, highlightId, onSelect }: MapViewProps) {
  const unit = usePreferences((s) => s.distanceUnit)
  const [dayChoice, setDayChoice] = useState<ISODate | "all">("all")
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [mapRef, mapWidth] = useElementWidth<HTMLDivElement>(500)

  const routes = useMemo(() => planDays(plan).map((date) => dayRoute(plan, date)), [plan])
  const shownDay = dayChoice !== "all" && routes.some((r) => r.date === dayChoice) ? dayChoice : "all"
  const visible: VisibleRoute[] = routes
    .map((route, dayIndex) => ({ route, dayIndex }))
    .filter(({ route }) => shownDay === "all" || route.date === shownDay)
  // Separation is set in pixels, so markers never overlap however small the map renders.
  const markers = buildMarkers(visible, MARKER_SPACING_PX / (Math.max(mapWidth, 1) / VIEW.width))
  const markerFor = (date: ISODate, locationId: string) => markers.find((m) => m.key === `${date}:${locationId}`)!

  const activeId = hoveredId ?? selectedId
  const activeDate = plan.items.find((i) => i.id === activeId)?.date
  const usedLocations = new Set(markers.map((m) => m.location.id))
  const hasStops = markers.length > 0

  function handleMarkerClick(marker: Marker) {
    // Repeated clicks on a shared marker step through its activities.
    const index = marker.stops.findIndex((s) => s.item.id === selectedId)
    onSelect(marker.stops[(index + 1) % marker.stops.length].item.id)
  }

  return (
    <div className="flex h-full flex-col xl:flex-row">
      <div className="flex min-h-72 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 px-3 pt-3">
          <Select value={shownDay} onValueChange={(v) => setDayChoice(v as ISODate | "all")}>
            <SelectTrigger size="sm" className="w-48" aria-label="Days on the map">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All days</SelectItem>
              {routes.map((route, i) => (
                <SelectItem key={route.date} value={route.date}>
                  <span className="size-2 rounded-full" style={{ background: dayColor(i) }} aria-hidden />
                  Day {i + 1} · {format(parseISO(route.date), "EEE, MMM d")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Schematic map · straight-line distances</p>
        </div>

        {/* A size container, so the map can keep its proportions in whatever space is left. */}
        <div className="relative min-h-0 flex-1 p-3 [container-type:size]">
          <div
            ref={mapRef}
            role="group"
            aria-label={shownDay === "all" ? "Map of all days" : `Map of Day ${visible[0]?.dayIndex + 1}`}
            className="absolute inset-0 m-auto overflow-hidden rounded-lg border shadow-xs"
            style={{
              width: `min(100cqw - 1.5rem, (100cqh - 1.5rem) * ${VIEW.width / VIEW.height})`,
              height: `min(100cqh - 1.5rem, (100cqw - 1.5rem) * ${VIEW.height / VIEW.width})`,
            }}
          >
            <svg
              viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}`}
              className="absolute inset-0 size-full"
              aria-hidden
            >
              <defs>
                {visible.map(({ dayIndex }) => (
                  <marker
                    key={dayIndex}
                    id={`arrow-${dayIndex}`}
                    viewBox="0 0 10 10"
                    refX="5"
                    refY="5"
                    markerWidth="2.2"
                    markerHeight="2.2"
                    markerUnits="userSpaceOnUse"
                    orient="auto"
                  >
                    <path d="M1 1 L9 5 L1 9 Z" fill={dayColor(dayIndex)} />
                  </marker>
                ))}
              </defs>
              <MapArt />
              {SAMPLE_LOCATIONS.filter((l) => !usedLocations.has(l.id)).map((l) => (
                <circle
                  key={l.id}
                  cx={l.x}
                  cy={l.y}
                  r="0.8"
                  fill="var(--map-land)"
                  stroke="var(--muted-foreground)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                >
                  <title>{l.name}</title>
                </circle>
              ))}
              {markers
                .filter((m) => Math.hypot(m.x - m.location.x, m.y - m.location.y) > 0.8)
                .map((m) => (
                  <g key={m.key} stroke="var(--muted-foreground)" opacity="0.7">
                    <line
                      x1={m.location.x}
                      y1={m.location.y}
                      x2={m.x}
                      y2={m.y}
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                    <circle cx={m.location.x} cy={m.location.y} r="0.5" fill="var(--muted-foreground)" />
                  </g>
                ))}
              {visible.map(({ route, dayIndex }) => {
                const dimmed = shownDay === "all" && activeDate !== undefined && activeDate !== route.date
                return (
                  <g key={route.date} opacity={dimmed ? 0.25 : 1} className="transition-opacity">
                    {route.legs.map((leg) => {
                      const a = markerFor(route.date, leg.from.location.id)
                      const b = markerFor(route.date, leg.to.location.id)
                      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
                      return (
                        <path
                          key={leg.from.item.id}
                          d={`M${a.x} ${a.y} L${mid.x} ${mid.y} L${b.x} ${b.y}`}
                          fill="none"
                          stroke={dayColor(dayIndex)}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                          markerMid={`url(#arrow-${dayIndex})`}
                        />
                      )
                    })}
                  </g>
                )
              })}
            </svg>

            {markers.map((marker) => {
              const ids = marker.stops.map((s) => s.item.id)
              const selected = selectedId !== null && ids.includes(selectedId)
              const hovered = hoveredId !== null && ids.includes(hoveredId)
              const dimmed = shownDay === "all" && activeDate !== undefined && !marker.key.startsWith(activeDate)
              const flip = marker.x > 60
              const times = marker.stops
                .map((s) => `${s.activity.title} at ${formatClock(s.item.startTime)}`)
                .join(", ")
              return (
                <button
                  key={marker.key}
                  type="button"
                  onClick={() => handleMarkerClick(marker)}
                  onMouseEnter={() => setHoveredId(ids[0])}
                  onMouseLeave={() => setHoveredId(null)}
                  onFocus={() => setHoveredId(ids[0])}
                  onBlur={() => setHoveredId(null)}
                  aria-pressed={selected}
                  aria-label={`Day ${marker.dayIndex + 1}, ${marker.location.name}: stop ${marker.stops.map((s) => s.number).join(" and ")}. ${times}.`}
                  className={cn(
                    "group absolute flex h-6 min-w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums text-white shadow-md ring-2 ring-background outline-none transition-[transform,opacity]",
                    "hover:z-20 hover:scale-110 focus-visible:z-20 focus-visible:ring-ring",
                    (selected || hovered) && "z-10 scale-110",
                    selected && "ring-foreground",
                    dimmed && !selected && "opacity-40",
                    ids.includes(highlightId ?? "") && "animate-pulse",
                  )}
                  style={{
                    left: `${((marker.x - VIEW.x) / VIEW.width) * 100}%`,
                    top: `${((marker.y - VIEW.y) / VIEW.height) * 100}%`,
                    background: dayColor(marker.dayIndex),
                  }}
                >
                  {marker.stops.map((s) => s.number).join("·")}
                  <span
                    className={cn(
                      "pointer-events-none absolute top-1/2 -translate-y-1/2 rounded bg-popover px-1.5 py-0.5 text-[0.7rem] font-medium whitespace-nowrap text-popover-foreground shadow ring-1 ring-border",
                      flip ? "right-full mr-1.5" : "left-full ml-1.5",
                      selected || hovered ? "block" : "hidden group-hover:block group-focus-visible:block",
                    )}
                    aria-hidden
                  >
                    {marker.location.name}
                  </span>
                </button>
              )
            })}

            {!hasStops && (
              <div className="absolute inset-0 grid place-items-center p-6">
                <div className="flex max-w-xs items-start gap-3 rounded-lg border bg-card/95 p-4 text-sm shadow-sm backdrop-blur">
                  <MapPinned className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div>
                    <p className="font-medium">
                      {shownDay === "all" ? "Nothing on the map yet" : `No places on Day ${visible[0].dayIndex + 1}`}
                    </p>
                    <p className="text-muted-foreground">
                      Activities with a location appear here, connected in the order you'll visit them.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <MapItinerary
        visible={visible}
        unit={unit}
        selectedId={selectedId}
        hoveredId={hoveredId}
        onHover={setHoveredId}
        onSelect={onSelect}
      />
    </div>
  )
}

/** The stops as a list: the map's text equivalent, and a quick way to pick an activity. */
function MapItinerary({
  visible,
  unit,
  selectedId,
  hoveredId,
  onHover,
  onSelect,
}: {
  visible: VisibleRoute[]
  unit: "km" | "mi"
  selectedId: string | null
  hoveredId: string | null
  onHover: (itemId: string | null) => void
  onSelect: (itemId: string) => void
}) {
  return (
    <section
      aria-label="Itinerary"
      className="relative max-h-[45%] shrink-0 overflow-y-auto overscroll-contain border-t bg-background xl:max-h-none xl:w-72 xl:border-t-0 xl:border-l"
    >
      {visible.map(({ route, dayIndex }) => {
        const color = dayColor(dayIndex)
        const headingId = `itinerary-${route.date}`
        return (
          <div key={route.date} className="border-b last:border-b-0">
            <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
              <h3 id={headingId} className="min-w-0 flex-1 truncate text-sm font-semibold">
                Day {dayIndex + 1}{" "}
                <span className="font-normal text-muted-foreground">· {format(parseISO(route.date), "EEE d")}</span>
              </h3>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {route.stops.length} {route.stops.length === 1 ? "stop" : "stops"}
                {route.legs.length > 0 && ` · ≈ ${formatDistance(route.totalKm, unit)}`}
              </span>
            </div>
            {route.stops.length === 0 ? (
              <p className="px-4 pb-3 text-sm text-muted-foreground">No places on this day.</p>
            ) : (
              <ol aria-labelledby={headingId} className="pb-2">
                {route.stops.map((stop, i) => {
                  const leg = route.legs.find((l) => l.to.item.id === stop.item.id)
                  const end = (stop.item.startTime + stop.item.duration) % DAY_MINUTES
                  return (
                    <Fragment key={stop.item.id}>
                      {i > 0 && (
                        <li aria-hidden className="flex items-center gap-2 py-0.5 pl-[1.6rem] text-[0.7rem] text-muted-foreground">
                          <span className="h-4 w-0.5 rounded-full" style={{ background: color, opacity: 0.5 }} />
                          {leg ? `≈ ${formatDistance(leg.km, unit)}` : "Same place"}
                        </li>
                      )}
                      <li data-item-id={stop.item.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(stop.item.id)}
                          onMouseEnter={() => onHover(stop.item.id)}
                          onMouseLeave={() => onHover(null)}
                          onFocus={() => onHover(stop.item.id)}
                          onBlur={() => onHover(null)}
                          aria-pressed={stop.item.id === selectedId}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-4 py-1.5 text-left text-sm outline-none",
                            "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                            stop.item.id === hoveredId && "bg-muted/60",
                            stop.item.id === selectedId && "bg-muted shadow-[inset_3px_0_0_var(--primary)]",
                          )}
                        >
                          <span
                            className="grid size-5 shrink-0 place-items-center rounded-full text-[0.7rem] font-semibold text-white"
                            style={{ background: color }}
                            aria-hidden
                          >
                            {stop.number}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{stop.activity.title}</span>
                            <span className="block truncate text-xs tabular-nums text-muted-foreground">
                              {formatClock(stop.item.startTime)}–{formatClock(end)} · {stop.location.name}
                            </span>
                          </span>
                          {leg && <span className="sr-only">, about {formatDistance(leg.km, unit)} from the previous stop</span>}
                        </button>
                      </li>
                    </Fragment>
                  )
                })}
              </ol>
            )}
            {route.unplaced.length > 0 && (
              <p className="px-4 pb-3 text-xs text-muted-foreground">
                Not on the map (no location):{" "}
                {route.unplaced.map((u) => `${u.activity.title} ${formatClock(u.item.startTime)}`).join(", ")}
              </p>
            )}
          </div>
        )
      })}
    </section>
  )
}
