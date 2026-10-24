import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import {
  Archive,
  Blocks,
  CalendarRange,
  Download,
  Map as MapIcon,
  MousePointerClick,
  Plus,
  Search,
  Sparkles,
  Upload,
  X,
} from "lucide-react"
import { useNavigate, useSearchParams } from "react-router"
import { toast } from "sonner"

import { AppHeader } from "@/components/app-header"
import { PlanCard, PlanCardSkeleton } from "@/components/plans/plan-card"
import { PlanFormDialog } from "@/components/plans/plan-form-dialog"
import { RecoveryNotice } from "@/components/recovery-notice"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useHydrated } from "@/hooks/use-hydrated"
import { downloadBackup, fromPlanFile } from "@/lib/plan-file"
import type { Plan } from "@/lib/types"
import { usePlansStore } from "@/store/plans-store"

type SortKey = "updated" | "start" | "name"

const SORTERS: Record<SortKey, { label: string; compare: (a: Plan, b: Plan) => number }> = {
  updated: { label: "Last edited", compare: (a, b) => b.updatedAt - a.updatedAt },
  start: { label: "Start date", compare: (a, b) => a.startDate.localeCompare(b.startDate) },
  name: { label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
}

export function DashboardPage() {
  const navigate = useNavigate()
  const hydrated = useHydrated()
  const plans = usePlansStore((s) => s.plans)
  const [params, setParams] = useSearchParams()
  const [createOpen, setCreateOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const tab = params.get("tab") === "archived" ? "archived" : "active"
  // The search box owns its text so typing stays instant; the URL follows for sharing and reloads.
  const [query, setQuery] = useState(() => params.get("q") ?? "")
  const sort = (params.get("sort") as SortKey) in SORTERS ? (params.get("sort") as SortKey) : "updated"

  function setParam(key: string, value: string, fallback: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === fallback) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )
  }

  useEffect(() => {
    setParams(
      (prev) => {
        if ((prev.get("q") ?? "") === query) return prev
        const next = new URLSearchParams(prev)
        if (query) next.set("q", query)
        else next.delete("q")
        return next
      },
      { replace: true },
    )
  }, [query, setParams])

  const counts = useMemo(
    () => ({
      active: plans.filter((p) => !p.archived).length,
      archived: plans.filter((p) => p.archived).length,
    }),
    [plans],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return plans
      .filter((p) => p.archived === (tab === "archived"))
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort(SORTERS[sort].compare)
  }, [plans, tab, query, sort])

  function handleCreateSample() {
    const id = usePlansStore.getState().createSamplePlan()
    navigate(`/plans/${id}`)
    toast.success("Sample trip added", { description: "Explore it, change it, or delete it whenever you like." })
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset so choosing the same file again still triggers a change.
    event.target.value = ""
    if (!file) return
    try {
      const results = fromPlanFile(await file.text())
      const ids = usePlansStore.getState().importPlans(results.map((r) => r.plan))
      const description = results.some((r) => r.repairs > 0)
        ? "Some unreadable parts of the file were left out."
        : undefined
      if (ids.length === 1) {
        toast.success(`Imported “${results[0].plan.name}”`, {
          description,
          action: { label: "Open", onClick: () => navigate(`/plans/${ids[0]}`) },
        })
      } else {
        toast.success(`Imported ${ids.length} plans`, { description })
      }
      setParam("tab", "active", "active")
    } catch (error) {
      toast.error(`Couldn't import “${file.name}”`, {
        description: error instanceof Error ? error.message : "The file couldn't be read.",
      })
    }
  }

  function handleBackup() {
    downloadBackup(plans)
    toast.success(`Downloaded ${plans.length} ${plans.length === 1 ? "plan" : "plans"}`, {
      description: "Import the file to restore them here or in another browser.",
    })
  }

  const hasAnyPlans = plans.length > 0

  return (
    <div className="min-h-dvh bg-canvas">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 id="plans-heading" tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
              Your plans
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {hydrated && hasAnyPlans
                ? `${counts.active} active${counts.archived ? ` · ${counts.archived} archived` : ""}`
                : "Build trips, events and schedules piece by piece."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={handleImport}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload data-icon="inline-start" />
              Import
            </Button>
            {hasAnyPlans && (
              <>
                <Button variant="outline" onClick={handleBackup}>
                  <Download data-icon="inline-start" />
                  Back up all
                </Button>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus data-icon="inline-start" />
                  New plan
                </Button>
              </>
            )}
          </div>
        </div>

        <RecoveryNotice />

        {!hydrated ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading plans">
            {Array.from({ length: 3 }, (_, i) => (
              <PlanCardSkeleton key={i} />
            ))}
          </div>
        ) : !hasAnyPlans ? (
          <FirstUse onCreate={() => setCreateOpen(true)} onSample={handleCreateSample} />
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Tabs value={tab} onValueChange={(v) => setParam("tab", v, "active")}>
                <TabsList>
                  <TabsTrigger value="active">
                    Active <span className="tabular-nums text-muted-foreground">{counts.active}</span>
                  </TabsTrigger>
                  <TabsTrigger value="archived">
                    Archived <span className="tabular-nums text-muted-foreground">{counts.archived}</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex flex-1 gap-2 sm:justify-end">
                <div className="relative flex-1 sm:max-w-64">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search plans"
                    aria-label="Search plans by name"
                    className="pl-8"
                  />
                </div>
                <Select value={sort} onValueChange={(v) => setParam("sort", v, "updated")}>
                  <SelectTrigger className="w-36" aria-label="Sort plans">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {Object.entries(SORTERS).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {visible.length > 0 ? (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((plan) => (
                  <li key={plan.id}>
                    <PlanCard plan={plan} />
                  </li>
                ))}
              </ul>
            ) : query.trim() ? (
              <Empty className="border border-dashed bg-card">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Search />
                  </EmptyMedia>
                  <EmptyTitle>No plans match “{query.trim()}”</EmptyTitle>
                  <EmptyDescription>
                    Check the spelling{tab === "active" && counts.archived ? ", or look in Archived" : ""}.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={() => setQuery("")}>
                    <X data-icon="inline-start" />
                    Clear search
                  </Button>
                </EmptyContent>
              </Empty>
            ) : tab === "archived" ? (
              <Empty className="border border-dashed bg-card">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Archive />
                  </EmptyMedia>
                  <EmptyTitle>Nothing archived</EmptyTitle>
                  <EmptyDescription>
                    Archive finished plans to keep your list tidy. You can restore them any time.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Empty className="border border-dashed bg-card">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CalendarRange />
                  </EmptyMedia>
                  <EmptyTitle>No active plans</EmptyTitle>
                  <EmptyDescription>All your plans are archived. Start something new.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus data-icon="inline-start" />
                    New plan
                  </Button>
                </EmptyContent>
              </Empty>
            )}
          </>
        )}
      </main>

      <PlanFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(input) => {
          const id = usePlansStore.getState().createPlan(input)
          setCreateOpen(false)
          navigate(`/plans/${id}`)
          toast.success(`Created “${input.name}”`)
        }}
      />
    </div>
  )
}

const FIRST_USE_STEPS = [
  { icon: CalendarRange, title: "Set the frame", text: "Name your plan and pick its dates and daily hours." },
  { icon: MousePointerClick, title: "Compose", text: "Drag activities onto days and move them around freely." },
  { icon: MapIcon, title: "Check it adds up", text: "Conflicts, free time, budget and the map update as you go." },
]

function FirstUse({ onCreate, onSample }: { onCreate: () => void; onSample: () => void }) {
  return (
    <Empty className="border border-dashed bg-card py-12">
      <EmptyHeader className="max-w-md">
        <EmptyMedia variant="icon">
          <Blocks />
        </EmptyMedia>
        <EmptyTitle className="text-lg">Compose your first plan</EmptyTitle>
        <EmptyDescription>
          Plans are built from pieces you can move around, not long forms. Start from scratch or explore a
          ready-made weekend trip.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-2xl">
        <ol className="grid w-full gap-3 text-left sm:grid-cols-3">
          {FIRST_USE_STEPS.map((step, i) => (
            <li key={step.title} className="rounded-lg border bg-muted/40 p-3">
              <div className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                <step.icon className="size-4 text-muted-foreground" aria-hidden />
                <span>
                  {i + 1}. {step.title}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button onClick={onCreate}>
            <Plus data-icon="inline-start" />
            Create a plan
          </Button>
          <Button variant="outline" onClick={onSample}>
            <Sparkles data-icon="inline-start" />
            Try a sample trip
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  )
}
