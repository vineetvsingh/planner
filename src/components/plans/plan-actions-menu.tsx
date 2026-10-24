import { useState } from "react"
import {
  Archive,
  ArchiveRestore,
  CircleDot,
  Copy,
  Download,
  Ellipsis,
  ExternalLink,
  Link2,
  Pencil,
  Printer,
  Settings2,
  Trash2,
} from "lucide-react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import { PlanFormDialog } from "@/components/plans/plan-form-dialog"
import { RenamePlanDialog } from "@/components/plans/rename-plan-dialog"
import { SharePlanDialog } from "@/components/plans/share-plan-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { downloadText, fileNameFor, toPlanFile } from "@/lib/plan-file"
import { PLAN_STATUSES, PLAN_STATUS_ORDER } from "@/lib/plan-meta"
import type { Plan, PlanStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { usePlansStore } from "@/store/plans-store"

/**
 * Archiving or deleting removes the card that held focus, which would drop keyboard
 * users at the top of the document. Land them on the list heading instead.
 */
function focusDashboardHeading() {
  requestAnimationFrame(() => document.getElementById("plans-heading")?.focus())
}

interface PlanActionsMenuProps {
  plan: Plan
  /** Where the menu lives; the editor hides "Open" and leaves the page after deleting. */
  context: "dashboard" | "editor"
  className?: string
}

export function PlanActionsMenu({ plan, context, className }: PlanActionsMenuProps) {
  const navigate = useNavigate()
  const { updatePlan, duplicatePlan, setArchived, deletePlan, restorePlan } = usePlansStore.getState()
  const [dialog, setDialog] = useState<"rename" | "settings" | "delete" | "share" | null>(null)
  const closeDialog = (open: boolean) => !open && setDialog(null)

  function handleDuplicate() {
    const id = duplicatePlan(plan.id)
    if (!id) return
    toast.success(`Duplicated “${plan.name}”`, {
      action: { label: "Open", onClick: () => navigate(`/plans/${id}`) },
    })
  }

  function handleArchive(archived: boolean) {
    setArchived(plan.id, archived)
    toast.success(archived ? `Archived “${plan.name}”` : `Restored “${plan.name}”`, {
      action: { label: "Undo", onClick: () => setArchived(plan.id, !archived) },
    })
    if (context === "editor") {
      if (archived) navigate("/")
    } else {
      focusDashboardHeading()
    }
  }

  function handleDelete() {
    const snapshot = plan
    deletePlan(plan.id)
    setDialog(null)
    if (context === "editor") navigate("/")
    else focusDashboardHeading()
    toast(`Deleted “${snapshot.name}”`, {
      action: { label: "Undo", onClick: () => restorePlan(snapshot) },
    })
  }

  function handleDownload() {
    downloadText(toPlanFile([plan]), fileNameFor(plan))
    toast.success("Plan downloaded", { description: "Open it later with Import on the dashboard, here or on another device." })
  }

  const itemCount = plan.items.length

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("relative z-10", className)}
            aria-label={`Actions for ${plan.name}`}
          >
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {context === "dashboard" && (
            <DropdownMenuItem onSelect={() => navigate(`/plans/${plan.id}`)}>
              <ExternalLink />
              {plan.archived ? "View plan" : "Open plan"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem disabled={plan.archived} onSelect={() => setDialog("rename")}>
            <Pencil />
            Rename…
          </DropdownMenuItem>
          <DropdownMenuItem disabled={plan.archived} onSelect={() => setDialog("settings")}>
            <Settings2 />
            Plan settings…
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={plan.archived}>
              <CircleDot />
              Status
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={plan.status}
                onValueChange={(status) => updatePlan(plan.id, { status: status as PlanStatus })}
              >
                {PLAN_STATUS_ORDER.map((status) => (
                  <DropdownMenuRadioItem key={status} value={status}>
                    <span className={cn("size-2 rounded-full", PLAN_STATUSES[status].dot)} aria-hidden />
                    {PLAN_STATUSES[status].label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onSelect={handleDuplicate}>
            <Copy />
            Duplicate
          </DropdownMenuItem>
          {plan.archived ? (
            <DropdownMenuItem onSelect={() => handleArchive(false)}>
              <ArchiveRestore />
              Restore from archive
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => handleArchive(true)}>
              <Archive />
              Archive
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Export</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => navigate(`/plans/${plan.id}/print`)}>
            <Printer />
            Print or save as PDF
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("share")}>
            <Link2 />
            Share read-only link…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleDownload}>
            <Download />
            Download as file
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
            <Trash2 />
            Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenamePlanDialog
        open={dialog === "rename"}
        onOpenChange={closeDialog}
        currentName={plan.name}
        onRename={(name) => {
          updatePlan(plan.id, { name })
          setDialog(null)
          toast.success("Plan renamed")
        }}
      />

      <PlanFormDialog
        open={dialog === "settings"}
        onOpenChange={closeDialog}
        plan={plan}
        onSubmit={(input) => {
          updatePlan(plan.id, input)
          setDialog(null)
          toast.success("Plan settings saved")
        }}
      />

      <SharePlanDialog plan={plan} open={dialog === "share"} onOpenChange={closeDialog} />

      <AlertDialog open={dialog === "delete"} onOpenChange={closeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{plan.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {itemCount > 0
                ? `This removes the plan and its ${itemCount} scheduled ${itemCount === 1 ? "activity" : "activities"}. `
                : "This removes the plan. "}
              If you only want it out of the way, archive it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {!plan.archived && (
              <Button
                variant="outline"
                onClick={() => {
                  setDialog(null)
                  handleArchive(true)
                }}
              >
                Archive instead
              </Button>
            )}
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
