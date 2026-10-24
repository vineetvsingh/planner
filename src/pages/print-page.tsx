import { useEffect, useState } from "react"
import { ArrowLeft, Printer } from "lucide-react"
import { Link, useParams, useSearchParams } from "react-router"

import { PlanDocument } from "@/components/plan-document"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useHydrated } from "@/hooks/use-hydrated"
import { PlanNotFound } from "@/pages/plan-editor-page"
import { usePlan } from "@/store/plans-store"
import { usePreferences } from "@/store/preferences-store"

type Part = "maps" | "notes"

/** Print preview for one plan. `?auto=1` opens the print dialog straight away (used by Ctrl+P). */
export function PrintPage() {
  const { planId } = useParams()
  const hydrated = useHydrated()
  const plan = usePlan(planId)
  const unit = usePreferences((s) => s.distanceUnit)
  const [params, setParams] = useSearchParams()
  const [parts, setParts] = useState<Part[]>(["maps", "notes"])
  const autoPrint = params.get("auto") === "1"

  useEffect(() => {
    if (!plan) return
    document.title = `${plan.name} · Plan Composer`
    return () => {
      document.title = "Plan Composer"
    }
  }, [plan])

  useEffect(() => {
    if (!plan || !autoPrint) return
    // Let the document paint first so the dialog previews the finished page. The flag is
    // cleared in the same step, so reloading the preview doesn't print again.
    const timer = window.setTimeout(() => {
      setParams({}, { replace: true })
      window.print()
    }, 250)
    return () => window.clearTimeout(timer)
  }, [plan, autoPrint, setParams])

  if (!hydrated) return <Skeleton className="m-6 h-96" aria-label="Loading plan" />
  if (!plan) return <PlanNotFound />

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-background px-4 py-2 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/plans/${plan.id}`}>
            <ArrowLeft data-icon="inline-start" />
            Back to plan
          </Link>
        </Button>
        <h1 className="text-sm font-semibold">Print preview</h1>
        <div className="ml-auto flex items-center gap-2">
          <ToggleGroup
            type="multiple"
            size="sm"
            variant="outline"
            value={parts}
            onValueChange={(v) => setParts(v as Part[])}
            aria-label="Include"
          >
            <ToggleGroupItem value="maps" className="px-3 text-xs">
              Maps
            </ToggleGroupItem>
            <ToggleGroupItem value="notes" className="px-3 text-xs">
              Notes
            </ToggleGroupItem>
          </ToggleGroup>
          <Button size="sm" onClick={() => window.print()}>
            <Printer data-icon="inline-start" />
            Print or save as PDF
          </Button>
        </div>
      </div>
      <main className="px-4 py-6 sm:py-10 print:p-0">
        <PlanDocument
          plan={plan}
          showMaps={parts.includes("maps")}
          showNotes={parts.includes("notes")}
          distanceUnit={unit}
        />
      </main>
    </div>
  )
}
