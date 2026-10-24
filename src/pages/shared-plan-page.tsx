import { useEffect, useState } from "react"
import { CopyPlus, Eye, Link2Off, Printer } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router"
import { toast } from "sonner"

import { AppHeader } from "@/components/app-header"
import { PlanDocument } from "@/components/plan-document"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { decodeSharedPlan } from "@/lib/plan-file"
import type { Plan } from "@/lib/types"
import { usePlansStore } from "@/store/plans-store"
import { usePreferences } from "@/store/preferences-store"

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; plan: Plan }

/** A plan opened from a share link: read-only, with the option to keep a copy. */
export function SharedPlanPage() {
  const { hash } = useLocation()
  const navigate = useNavigate()
  const unit = usePreferences((s) => s.distanceUnit)
  const [state, setState] = useState<LoadState>({ status: "loading" })

  useEffect(() => {
    let cancelled = false
    const fragment = hash.replace(/^#/, "")
    const load = fragment
      ? decodeSharedPlan(fragment).then((r): LoadState => ({ status: "ready", plan: r.plan }))
      : Promise.resolve<LoadState>({ status: "error", message: "This link doesn't include a plan." })
    load
      .catch((error: Error): LoadState => ({ status: "error", message: error.message }))
      .then((next) => !cancelled && setState(next))
    return () => {
      cancelled = true
    }
  }, [hash])

  function saveCopy(plan: Plan) {
    const [id] = usePlansStore.getState().importPlans([plan])
    toast.success(`Saved “${plan.name}” to your plans`, { description: "This copy is yours to edit." })
    navigate(`/plans/${id}`)
  }

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <div className="print:hidden">
        <AppHeader />
      </div>
      {state.status === "loading" && (
        <div className="mx-auto max-w-4xl space-y-4 px-4 py-10" aria-busy="true" aria-label="Opening shared plan">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-64" />
        </div>
      )}
      {state.status === "error" && (
        <main className="mx-auto max-w-xl px-4 py-16">
          <Empty className="border border-dashed bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Link2Off />
              </EmptyMedia>
              <EmptyTitle>Can't open this shared plan</EmptyTitle>
              <EmptyDescription>{state.message}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild variant="outline">
                <Link to="/">Go to your plans</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </main>
      )}
      {state.status === "ready" && (
        <>
          <div className="border-b bg-sky-50 px-4 py-3 text-sm text-sky-950 print:hidden dark:bg-sky-950/40 dark:text-sky-100">
            <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2">
              <p className="flex flex-1 items-center gap-2">
                <Eye className="size-4 shrink-0" aria-hidden />
                <span>
                  <strong className="font-semibold">Read-only snapshot.</strong> Someone shared this plan with you; changes
                  they make later won't appear here.
                </span>
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="bg-background" onClick={() => window.print()}>
                  <Printer data-icon="inline-start" />
                  Print
                </Button>
                <Button size="sm" onClick={() => saveCopy(state.plan)}>
                  <CopyPlus data-icon="inline-start" />
                  Save a copy to my plans
                </Button>
              </div>
            </div>
          </div>
          <main className="px-4 py-6 sm:py-10 print:p-0">
            <PlanDocument plan={state.plan} showMaps showNotes distanceUnit={unit} />
          </main>
        </>
      )}
    </div>
  )
}
