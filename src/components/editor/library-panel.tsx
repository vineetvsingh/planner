import { useMemo, useState, type Ref } from "react"
import { useDraggable } from "@dnd-kit/core"
import { format, parseISO } from "date-fns"
import { GripVertical, Plus, Search, SearchX } from "lucide-react"

import { CustomActivityDialog } from "@/components/editor/custom-activity-dialog"
import type { DragData } from "@/components/editor/drag-context"
import { PanelHeading } from "@/components/editor/panel-heading"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { CATEGORIES } from "@/lib/plan-meta"
import { formatCurrency, formatDuration, getLocation, planDays } from "@/lib/plan-utils"
import { SAMPLE_ACTIVITIES } from "@/lib/sample-data"
import type { Activity, ActivityCategory, ISODate, Plan } from "@/lib/types"
import { cn } from "@/lib/utils"
import type { ActivityTemplate } from "@/store/plans-store"

const FILTERS: { value: ActivityCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sight", label: "Sights" },
  { value: "food", label: "Food" },
  { value: "activity", label: "Activities" },
  { value: "travel", label: "Travel" },
  { value: "rest", label: "Rest" },
]

interface LibraryPanelProps {
  plan: Plan
  targetDate: ISODate
  onTargetDateChange: (date: ISODate) => void
  onAdd: (template: ActivityTemplate) => void
  readOnly: boolean
  searchRef?: Ref<HTMLInputElement>
}

export function LibraryPanel({ plan, targetDate, onTargetDateChange, onAdd, readOnly, searchRef }: LibraryPanelProps) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<ActivityCategory | "all">("all")
  const [customOpen, setCustomOpen] = useState(false)

  const days = planDays(plan)
  const dayIndex = Math.max(0, days.indexOf(targetDate))
  const targetLabel = `Day ${dayIndex + 1}`

  const usage = useMemo(() => {
    const counts = new Map<string, number>()
    const sourceById = new Map(plan.activities.map((a) => [a.id, a.sourceId]))
    for (const item of plan.items) {
      const source = sourceById.get(item.activityId)
      if (source) counts.set(source, (counts.get(source) ?? 0) + 1)
    }
    return counts
  }, [plan.activities, plan.items])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return SAMPLE_ACTIVITIES.filter((a) => filter === "all" || a.category === filter).filter(
      (a) =>
        !q ||
        a.title.toLowerCase().includes(q) ||
        getLocation(a.locationId)?.name.toLowerCase().includes(q) ||
        CATEGORIES[a.category].label.toLowerCase().includes(q),
    )
  }, [query, filter])

  function addFromLibrary(activity: Activity) {
    const { id, ...template } = activity
    onAdd({ ...template, sourceId: id })
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PanelHeading
        title="Activity library"
        description={readOnly ? "Restore the plan to add activities." : "Drag onto a day, or pick a day and press +."}
      />

      <div className="space-y-3 border-b p-3">
        <div className="flex items-center gap-2">
          <label htmlFor="library-target" className="shrink-0 text-xs font-medium text-muted-foreground">
            Add to
          </label>
          <Select value={targetDate} onValueChange={onTargetDateChange} disabled={readOnly}>
            <SelectTrigger id="library-target" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {days.map((date, i) => (
                <SelectItem key={date} value={date}>
                  Day {i + 1} · {format(parseISO(date), "EEE, MMM d")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search activities or places"
            aria-label="Search the activity library"
            className="pl-8"
          />
        </div>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          spacing={1}
          value={filter}
          onValueChange={(v) => setFilter((v || "all") as ActivityCategory | "all")}
          className="flex-wrap"
          aria-label="Filter by category"
        >
          {FILTERS.map((f) => (
            <ToggleGroupItem key={f.value} value={f.value} className="px-2 text-xs">
              {f.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex-1 p-3">
        {results.length > 0 ? (
          <ul className="space-y-1.5" aria-label="Library activities">
            {results.map((activity) => (
              <li key={activity.id}>
                <LibraryRow
                  activity={activity}
                  currency={plan.settings.currency}
                  usedCount={usage.get(activity.id) ?? 0}
                  targetLabel={targetLabel}
                  readOnly={readOnly}
                  onAdd={() => addFromLibrary(activity)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <Empty className="p-4">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchX />
              </EmptyMedia>
              <EmptyTitle className="text-sm">No matching activities</EmptyTitle>
              <EmptyDescription className="text-xs">
                {query.trim() ? `Nothing in the library matches “${query.trim()}”.` : "Nothing in this category yet."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="gap-2">
              {query.trim() && !readOnly && (
                <Button size="sm" onClick={() => setCustomOpen(true)}>
                  <Plus data-icon="inline-start" />
                  Create “{query.trim().slice(0, 24)}”
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setQuery("")
                  setFilter("all")
                }}
              >
                Clear filters
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </div>

      <div className="sticky bottom-0 border-t bg-background p-3">
        <Button
          variant="outline"
          className="w-full"
          disabled={readOnly}
          onClick={() => setCustomOpen(true)}
        >
          <Plus data-icon="inline-start" />
          Custom activity
        </Button>
      </div>

      <CustomActivityDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        initialTitle={results.length === 0 ? query.trim() : ""}
        currency={plan.settings.currency}
        targetLabel={targetLabel}
        onSubmit={(template) => {
          onAdd(template)
          setCustomOpen(false)
          setQuery("")
        }}
      />
    </div>
  )
}

function LibraryRow({
  activity,
  currency,
  usedCount,
  targetLabel,
  readOnly,
  onAdd,
}: {
  activity: Activity
  currency: string
  usedCount: number
  targetLabel: string
  readOnly: boolean
  onAdd: () => void
}) {
  // Only pointer listeners: the Add button is the keyboard route, so the row adds no extra tab stop.
  const { id, ...template } = activity
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `library:${id}`,
    data: { kind: "library", template: { ...template, sourceId: id } } satisfies DragData,
    disabled: readOnly,
  })
  const category = CATEGORIES[activity.category]
  const Icon = category.icon
  const location = getLocation(activity.locationId)
  const meta = [
    formatDuration(activity.duration),
    location?.name,
    activity.cost ? formatCurrency(activity.cost, currency) : undefined,
  ].filter(Boolean)

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      className={cn(
        "group flex touch-manipulation items-center gap-2 rounded-lg border bg-card p-2 pl-1 text-sm transition-colors hover:border-foreground/20",
        !readOnly && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
    >
      <GripVertical
        className={cn("size-3.5 shrink-0 text-muted-foreground/60", readOnly && "invisible")}
        aria-hidden
      />
      <span className={cn("grid size-7 shrink-0 place-items-center rounded-md", category.chip)}>
        <Icon className="size-3.5" aria-hidden />
        <span className="sr-only">{category.label}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{activity.title}</p>
        <p className="truncate text-xs text-muted-foreground">{meta.join(" · ")}</p>
      </div>
      {usedCount > 0 && (
        <span className="shrink-0 rounded-full bg-muted px-1.5 text-[0.7rem] font-medium tabular-nums text-muted-foreground">
          <span className="sr-only">Already in plan </span>
          {usedCount}×
        </span>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={readOnly}
            onClick={onAdd}
            aria-label={`Add ${activity.title} to ${targetLabel}`}
          >
            <Plus />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Add to {targetLabel}</TooltipContent>
      </Tooltip>
    </div>
  )
}
