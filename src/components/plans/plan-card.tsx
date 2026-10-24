import { formatDistanceToNow } from "date-fns"
import { Archive, Clock, ListChecks, MapPin, TriangleAlert } from "lucide-react"
import { Link } from "react-router"

import { PlanActionsMenu } from "@/components/plans/plan-actions-menu"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { PLAN_STATUSES, PLAN_TYPES } from "@/lib/plan-meta"
import { formatDateRange, formatDuration } from "@/lib/plan-utils"
import { getPlanStats } from "@/lib/schedule-analysis"
import type { Plan } from "@/lib/types"
import { cn } from "@/lib/utils"

export function PlanCard({ plan }: { plan: Plan }) {
  const type = PLAN_TYPES[plan.type]
  const status = PLAN_STATUSES[plan.status]
  const stats = getPlanStats(plan)
  const TypeIcon = type.icon
  const progressLabelId = `progress-${plan.id}`

  return (
    <Card
      className={cn(
        "relative transition-shadow focus-within:ring-3 focus-within:ring-ring/50 hover:shadow-md",
        plan.archived && "bg-muted/40",
      )}
    >
      <CardHeader>
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", type.tile)}>
            <TypeIcon className="size-4.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate">
              {/* Stretched link: the whole card opens the plan, while the menu stays separately focusable. */}
              <Link
                to={`/plans/${plan.id}`}
                className="outline-none after:absolute after:inset-0 after:rounded-[inherit] after:content-['']"
              >
                {plan.name}
              </Link>
            </CardTitle>
            <CardDescription className="mt-0.5">
              {type.label} · {formatDateRange(plan.startDate, plan.endDate)}
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <PlanActionsMenu plan={plan} context="dashboard" />
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span id={progressLabelId} className="text-muted-foreground">
            {stats.progress}% of available time planned
          </span>
          <span className="tabular-nums text-muted-foreground">
            {stats.days} {stats.days === 1 ? "day" : "days"}
          </span>
        </div>
        <Progress value={stats.progress} aria-labelledby={progressLabelId} />
      </CardContent>

      <CardFooter className="flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
        {plan.archived ? (
          <Badge variant="outline">
            <Archive aria-hidden />
            Archived
          </Badge>
        ) : (
          <Badge variant="outline">
            <span className={cn("size-1.5 rounded-full", status.dot)} aria-hidden />
            {status.label}
          </Badge>
        )}
        <span className="flex items-center gap-1.5">
          <ListChecks className="size-3.5" aria-hidden />
          {stats.activityCount}
          <span className="sr-only">activities</span>
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin className="size-3.5" aria-hidden />
          {stats.locationCount}
          <span className="sr-only">locations</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5" aria-hidden />
          {formatDuration(stats.scheduledMinutes)}
          <span className="sr-only">scheduled</span>
        </span>
        {stats.conflictCount > 0 && (
          <span
            className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400"
            title={`${stats.conflictCount} scheduling ${stats.conflictCount === 1 ? "conflict" : "conflicts"}`}
          >
            <TriangleAlert className="size-3.5" aria-hidden />
            {stats.conflictCount}
            <span className="sr-only">{stats.conflictCount === 1 ? "conflict" : "conflicts"}</span>
          </span>
        )}
        <span className="ml-auto text-xs">
          Edited {formatDistanceToNow(plan.updatedAt, { addSuffix: true })}
        </span>
      </CardFooter>
    </Card>
  )
}

export function PlanCardSkeleton() {
  return (
    <Card aria-hidden>
      <CardHeader>
        <div className="flex items-start gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-1.5 w-full" />
      </CardContent>
      <CardFooter className="gap-3">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </CardFooter>
    </Card>
  )
}
