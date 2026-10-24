import { CalendarClock, Keyboard, List, Map as MapIcon, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { DistanceUnit } from "@/lib/geo"
import { MOD_KEY } from "@/lib/platform"
import { TIMELINE_ZOOM, type TimelineZoom } from "@/store/preferences-store"

export type EditorView = "timeline" | "list" | "map"

const SHORTCUTS: [string[], string][] = [
  [["↑", "↓"], "Move 15 minutes"],
  [["←", "→"], "Move to the previous or next day"],
  [["Shift", "↑ ↓"], "Shorten or lengthen"],
  [["Delete"], "Remove"],
  [["Enter"], "Open details"],
  [[MOD_KEY, "Z"], "Undo"],
  [[MOD_KEY, "Shift", "Z"], "Redo"],
]

interface ViewToolbarProps {
  view: EditorView
  onViewChange: (view: EditorView) => void
  hourHeight: number
  onHourHeightChange: (height: number) => void
  distanceUnit: DistanceUnit
  onDistanceUnitChange: (unit: DistanceUnit) => void
}

export function ViewToolbar({
  view,
  onViewChange,
  hourHeight,
  onHourHeightChange,
  distanceUnit,
  onDistanceUnitChange,
}: ViewToolbarProps) {
  const zoom = (Object.keys(TIMELINE_ZOOM) as TimelineZoom[]).find((k) => TIMELINE_ZOOM[k] === hourHeight) ?? "comfortable"
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-background px-3 py-2">
      <Tabs value={view} onValueChange={(v) => onViewChange(v as EditorView)}>
        <TabsList aria-label="View">
          <TabsTrigger value="timeline">
            <CalendarClock aria-hidden />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="list">
            <List aria-hidden />
            List
          </TabsTrigger>
          <TabsTrigger value="map">
            <MapIcon aria-hidden />
            Map
          </TabsTrigger>
        </TabsList>
      </Tabs>


      <div className="ml-auto flex items-center gap-1">
        {view === "timeline" && (
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={zoom}
            onValueChange={(v) => v && onHourHeightChange(TIMELINE_ZOOM[v as TimelineZoom])}
            aria-label="Timeline zoom"
          >
            <ToggleGroupItem value="compact" aria-label="Compact" className="px-2 text-xs">
              S
            </ToggleGroupItem>
            <ToggleGroupItem value="comfortable" aria-label="Comfortable" className="px-2 text-xs">
              M
            </ToggleGroupItem>
            <ToggleGroupItem value="spacious" aria-label="Spacious" className="px-2 text-xs">
              L
            </ToggleGroupItem>
          </ToggleGroup>
        )}
        {view === "map" && (
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={distanceUnit}
            onValueChange={(v) => v && onDistanceUnitChange(v as DistanceUnit)}
            aria-label="Distance unit"
          >
            <ToggleGroupItem value="km" aria-label="Kilometres" className="px-2 text-xs">
              km
            </ToggleGroupItem>
            <ToggleGroupItem value="mi" aria-label="Miles" className="px-2 text-xs">
              mi
            </ToggleGroupItem>
          </ToggleGroup>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Keyboard shortcuts">
              <Keyboard />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <p className="mb-1 text-sm font-semibold">Keyboard</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Focus an activity on the timeline with Tab, then:
            </p>
            <dl className="space-y-1.5 text-sm">
              {SHORTCUTS.map(([keys, label]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="flex gap-1">
                    {keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Plus className="size-3.5 shrink-0" aria-hidden />
              Library items: Tab to their + button to add without dragging.
            </p>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
