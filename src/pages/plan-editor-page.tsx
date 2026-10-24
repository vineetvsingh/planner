import { useEffect, useMemo, useRef, useState } from "react"
import { ArchiveRestore, ArrowLeft, FileQuestion, Settings2 } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"

import { AppHeader } from "@/components/app-header"
import { EditorDnd } from "@/components/editor/editor-dnd"
import { HistoryControls } from "@/components/editor/history-controls"
import { ItemProperties } from "@/components/editor/item-properties"
import { LibraryPanel } from "@/components/editor/library-panel"
import { ListView } from "@/components/editor/list-view"
import { MapView } from "@/components/editor/map-view"
import { PlanSummary } from "@/components/editor/plan-summary"
import { TimelineView } from "@/components/editor/timeline-view"
import { ViewToolbar, type EditorView } from "@/components/editor/view-toolbar"
import { PlanActionsMenu } from "@/components/plans/plan-actions-menu"
import { PlanFormDialog } from "@/components/plans/plan-form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useHydrated } from "@/hooks/use-hydrated"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useScrollItemIntoView } from "@/hooks/use-scroll-item-into-view"
import { PLAN_STATUSES, PLAN_TYPES } from "@/lib/plan-meta"
import { formatClock, formatDateRange, planDays } from "@/lib/plan-utils"
import { MOD_KEY } from "@/lib/platform"
import { analyzePlan, suggestSlot } from "@/lib/schedule-analysis"
import type { ISODate, Minutes, Plan } from "@/lib/types"
import { cn } from "@/lib/utils"
import { announce } from "@/store/announcer"
import { historyDepth, undoIfLatest, usePlan, usePlansStore, type ActivityTemplate } from "@/store/plans-store"
import { usePreferences } from "@/store/preferences-store"

type Panel = "library" | "plan" | "details"

/** Toast "Undo" that refuses to revert anything newer than the change it announced. */
function undoAction(planId: string, depth: number) {
  return {
    label: "Undo",
    onClick: () => {
      if (!undoIfLatest(planId, depth)) {
        toast("You've made changes since", { description: `Use Undo (${MOD_KEY}+Z) to step back through them.` })
      }
    },
  }
}

const HIGHLIGHT_MS = 1600

export function PlanEditorPage() {
  const { planId } = useParams()
  const hydrated = useHydrated()
  const plan = usePlan(planId)

  if (!hydrated) return <EditorSkeleton />
  if (!plan) return <PlanNotFound />
  // Keyed so switching plans resets selection and panels.
  return <PlanEditor key={plan.id} plan={plan} />
}

function PlanEditor({ plan }: { plan: Plan }) {
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const [panel, setPanel] = useState<Panel>("plan")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [targetChoice, setTargetChoice] = useState<ISODate | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const hourHeight = usePreferences((s) => s.hourHeight)
  const setHourHeight = usePreferences((s) => s.setHourHeight)
  const preferredView = usePreferences((s) => s.defaultView)
  const setPreferredView = usePreferences((s) => s.setDefaultView)
  const distanceUnit = usePreferences((s) => s.distanceUnit)
  const setDistanceUnit = usePreferences((s) => s.setDistanceUnit)
  const view: EditorView = preferredView

  const type = PLAN_TYPES[plan.type]
  const status = PLAN_STATUSES[plan.status]
  const readOnly = plan.archived
  const days = planDays(plan)
  // Computed once per change and shared, so every panel reports the same numbers.
  const analysis = useMemo(() => analyzePlan(plan), [plan])
  const conflictCount = analysis.conflicts.length

  const selectedItem = plan.items.find((i) => i.id === selectedId)
  const selectedActivity = selectedItem && plan.activities.find((a) => a.id === selectedItem.activityId)
  // Follow the selected item's day unless the user picked one; fall back if dates changed.
  const targetDate =
    targetChoice && days.includes(targetChoice) ? targetChoice : (selectedItem?.date ?? days[0])

  useEffect(() => {
    if (!highlightId) return
    const timer = window.setTimeout(() => setHighlightId(null), HIGHLIGHT_MS)
    return () => window.clearTimeout(timer)
  }, [highlightId])

  useScrollItemIntoView(highlightId)

  // The editor itself doesn't print well; send Ctrl/⌘+P to the print layout instead.
  const navigate = useNavigate()
  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "p") {
        event.preventDefault()
        navigate(`/plans/${plan.id}/print?auto=1`)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [navigate, plan.id])

  function dayLabel(date: ISODate) {
    return `Day ${days.indexOf(date) + 1}`
  }

  function select(id: string) {
    setSelectedId(id)
    setPanel("details")
  }

  /** Adds at `startTime` when given (a timeline drop), otherwise in the day's first free slot. */
  function handleAdd(template: ActivityTemplate, date: ISODate = targetDate, startTime?: Minutes) {
    const result = usePlansStore.getState().addActivity(plan.id, template, date, startTime)
    const depth = historyDepth(plan.id)
    setHighlightId(result.itemId)
    // On desktop, open the new item for fine-tuning; on phones stay in the library to keep adding.
    if (isDesktop) setSelectedId(result.itemId)
    const where = `${dayLabel(date)} at ${formatClock(result.startTime)}`
    const undo = undoAction(plan.id, depth)
    if (result.fits) {
      toast.success(`Added “${template.title}” to ${where}`, { action: undo })
    } else {
      toast.warning(`No free slot left on ${dayLabel(date)}`, {
        description: `“${template.title}” was placed at ${formatClock(result.startTime)}, after the last activity. Adjust it in the details panel.`,
        action: undo,
      })
    }
  }

  function handleMove(itemId: string, date: ISODate, startTime: Minutes) {
    usePlansStore.getState().updateItem(plan.id, itemId, { item: { date, startTime } })
    if (isDesktop) setSelectedId(itemId)
    setHighlightId(itemId)
  }

  function handleRemove(itemId: string) {
    const title = titleOf(itemId)
    usePlansStore.getState().removeItem(plan.id, itemId)
    const depth = historyDepth(plan.id)
    if (selectedId === itemId) setSelectedId(null)
    toast(`Removed “${title}”`, {
      action: undoAction(plan.id, depth),
    })
  }

  function handleDuplicate(itemId: string) {
    const result = usePlansStore.getState().duplicateItem(plan.id, itemId)
    if (!result) return
    setSelectedId(result.itemId)
    setHighlightId(result.itemId)
    toast.success(`Duplicated to ${formatClock(result.startTime)}`)
  }

  function titleOf(itemId: string) {
    return plan.activities.find((a) => a.id === plan.items.find((i) => i.id === itemId)?.activityId)?.title ?? "activity"
  }

  /** Moves an item to the nearest free slot inside planning hours. */
  function handleFix(itemId: string) {
    const title = titleOf(itemId)
    const slot = suggestSlot(plan, itemId)
    if (!slot) {
      toast.error(`No free slot for “${title}”`, {
        description: "Shorten or remove something, or widen your planning hours in settings.",
      })
      return
    }
    usePlansStore.getState().updateItem(plan.id, itemId, { item: slot })
    const depth = historyDepth(plan.id)
    setHighlightId(itemId)
    const where = `${dayLabel(slot.date)} at ${formatClock(slot.startTime)}`
    toast.success(`Moved “${title}” to ${where}`, { action: undoAction(plan.id, depth) })
    announce(`Moved ${title} to ${where}.`)
  }

  function handleShow(itemId: string) {
    select(itemId)
    setHighlightId(itemId)
  }

  function handleAddHere(date: ISODate) {
    setTargetChoice(date)
    setPanel("library")
    // Wait a frame so the library is visible on small screens before focusing.
    requestAnimationFrame(() => searchRef.current?.focus())
  }

  return (
    // The editor is an app shell: panels scroll inside themselves, the page never does.
    // Scroll containers are positioned so absolutely placed content (like sr-only text) stays
    // inside them instead of stretching the page.
    <div className="relative flex h-dvh flex-col overflow-hidden bg-canvas">
      <AppHeader>
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to="/" aria-label="Back to all plans">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold sm:text-base">{plan.name}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {type.label} · {formatDateRange(plan.startDate, plan.endDate)}
          </p>
        </div>
        <Badge variant="outline" className="hidden sm:inline-flex">
          <span className={cn("size-1.5 rounded-full", status.dot)} aria-hidden />
          {status.label}
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          <HistoryControls planId={plan.id} disabled={readOnly} />
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Wrapper keeps the tooltip reachable while the button is disabled. */}
              <span
                tabIndex={readOnly ? 0 : -1}
                className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={readOnly}
                  onClick={() => setSettingsOpen(true)}
                  aria-label="Plan settings"
                >
                  <Settings2 />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{readOnly ? "Restore the plan to change settings" : "Plan settings"}</TooltipContent>
          </Tooltip>
          <PlanActionsMenu plan={plan} context="editor" />
        </div>
      </AppHeader>

      {readOnly && <ArchivedBanner plan={plan} />}

      {/* Small screens show one panel at a time. */}
      <div className="border-b bg-background px-4 py-2 lg:hidden">
        <Tabs value={panel} onValueChange={(v) => setPanel(v as Panel)}>
          <TabsList className="w-full">
            <TabsTrigger value="library">Library</TabsTrigger>
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="details">
              {selectedItem ? "Activity" : "Summary"}
              {conflictCount > 0 && (
                <span className="rounded-full bg-amber-100 px-1.5 text-xs tabular-nums text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  {conflictCount}
                  <span className="sr-only"> {conflictCount === 1 ? "conflict" : "conflicts"}</span>
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <EditorDnd
        plan={plan}
        hourHeight={hourHeight}
        onDropLibrary={(template, date, startTime) => handleAdd(template, date, startTime)}
        onMoveItem={handleMove}
      >
        {/* One row pinned to the space left; without it the row grows to the tallest panel and the page scrolls. */}
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[18rem_minmax(0,1fr)_20rem]">
          <aside
            aria-label="Activity library"
            className={cn("relative min-h-0 overflow-y-auto overscroll-contain border-r bg-background", panel !== "library" && "max-lg:hidden")}
          >
            <LibraryPanel
              plan={plan}
              targetDate={targetDate}
              onTargetDateChange={setTargetChoice}
              onAdd={(template) => handleAdd(template)}
              readOnly={readOnly}
              searchRef={searchRef}
            />
          </aside>

          <main
            aria-label="Plan days"
            className={cn("flex min-h-0 min-w-0 flex-col", panel !== "plan" && "max-lg:hidden")}
          >
            <ViewToolbar
              view={view}
              onViewChange={setPreferredView}
              hourHeight={hourHeight}
              onHourHeightChange={setHourHeight}
              distanceUnit={distanceUnit}
              onDistanceUnitChange={setDistanceUnit}
            />
            <div className="min-h-0 flex-1">
              {view === "timeline" ? (
                <TimelineView
                  plan={plan}
                  analysis={analysis}
                  selectedId={selectedId}
                  highlightId={highlightId}
                  targetDate={targetDate}
                  readOnly={readOnly}
                  hourHeight={hourHeight}
                  onSelect={select}
                  onRemove={handleRemove}
                  onAddHere={handleAddHere}
                />
              ) : view === "map" ? (
                <MapView plan={plan} selectedId={selectedId} highlightId={highlightId} onSelect={select} />
              ) : (
                <ListView
                  plan={plan}
                  analysis={analysis}
                  selectedId={selectedId}
                  highlightId={highlightId}
                  targetDate={targetDate}
                  readOnly={readOnly}
                  onSelect={select}
                  onRemove={handleRemove}
                  onAddHere={handleAddHere}
                />
              )}
            </div>
          </main>

          <aside
            aria-label={selectedItem ? "Activity details" : "Plan summary"}
            className={cn("relative min-h-0 overflow-y-auto overscroll-contain border-l bg-background", panel !== "details" && "max-lg:hidden")}
          >
            {selectedItem && selectedActivity ? (
              <ItemProperties
                // Remount per item so text drafts never leak between activities.
                key={selectedItem.id}
                plan={plan}
                item={selectedItem}
                activity={selectedActivity}
                conflicts={analysis.conflictsByItem.get(selectedItem.id) ?? []}
                readOnly={readOnly}
                onFix={() => handleFix(selectedItem.id)}
                onClose={() => {
                  setSelectedId(null)
                  setPanel("plan")
                }}
                onDuplicate={() => handleDuplicate(selectedItem.id)}
                onRemove={() => {
                  handleRemove(selectedItem.id)
                  setPanel("plan")
                }}
              />
            ) : (
              <PlanSummary
                plan={plan}
                analysis={analysis}
                readOnly={readOnly}
                onShowItem={handleShow}
                onFix={handleFix}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            )}
          </aside>
        </div>
      </EditorDnd>

      <PlanFormDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        plan={plan}
        onSubmit={(input) => {
          usePlansStore.getState().updatePlan(plan.id, input)
          setSettingsOpen(false)
          toast.success("Plan settings saved")
        }}
      />
    </div>
  )
}

function ArchivedBanner({ plan }: { plan: Plan }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:px-6 dark:bg-amber-950/50 dark:text-amber-200">
      <p className="flex-1">This plan is archived, so it's read-only.</p>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          usePlansStore.getState().setArchived(plan.id, false)
          toast.success(`Restored “${plan.name}”`)
        }}
      >
        <ArchiveRestore data-icon="inline-start" />
        Restore to edit
      </Button>
    </div>
  )
}

function EditorSkeleton() {
  return (
    <div className="flex h-dvh flex-col" aria-busy="true" aria-label="Loading plan">
      <div className="flex h-14 items-center gap-3 border-b px-4">
        <Skeleton className="size-7" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[18rem_1fr_20rem]">
        <Skeleton className="hidden lg:block" />
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="hidden lg:block" />
      </div>
    </div>
  )
}

export function PlanNotFound() {
  return (
    <div className="min-h-dvh bg-canvas">
      <AppHeader />
      <main className="mx-auto max-w-xl px-4 py-16">
        <Empty className="border border-dashed bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileQuestion />
            </EmptyMedia>
            <EmptyTitle>Plan not found</EmptyTitle>
            <EmptyDescription>
              It may have been deleted, or the link is from another browser. Plans are saved on this device only.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link to="/">
                <ArrowLeft data-icon="inline-start" />
                Back to plans
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      </main>
    </div>
  )
}

