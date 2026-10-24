import { useId, useState, type FormEvent } from "react"

import { CategorySelect, DurationSelect, LocationSelect } from "@/components/editor/activity-fields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { parseCost } from "@/lib/plan-utils"
import type { ActivityCategory } from "@/lib/types"
import type { ActivityTemplate } from "@/store/plans-store"

const TITLE_MAX = 80

interface CustomActivityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Prefills the title, e.g. from a library search that found nothing. */
  initialTitle?: string
  currency: string
  /** Shown in the submit button, e.g. "Day 2". */
  targetLabel: string
  onSubmit: (template: ActivityTemplate) => void
}

export function CustomActivityDialog({ open, onOpenChange, ...props }: CustomActivityDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && <CustomActivityForm {...props} onCancel={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function CustomActivityForm({
  initialTitle = "",
  currency,
  targetLabel,
  onSubmit,
  onCancel,
}: Omit<CustomActivityDialogProps, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const id = useId()
  const [title, setTitle] = useState(initialTitle)
  const [category, setCategory] = useState<ActivityCategory>("activity")
  const [duration, setDuration] = useState(60)
  const [locationId, setLocationId] = useState<string | undefined>()
  const [cost, setCost] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const trimmed = title.trim()
  const titleError = !trimmed
    ? "Give the activity a title."
    : trimmed.length > TITLE_MAX
      ? `Keep the title under ${TITLE_MAX} characters.`
      : undefined
  const parsedCost = parseCost(cost)
  const costError = parsedCost === null ? "Enter a positive number, or leave it empty." : undefined

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (titleError || costError) {
      document.getElementById(titleError ? `${id}-title` : `${id}-cost`)?.focus()
      return
    }
    onSubmit({ title: trimmed, category, duration, locationId, cost: parsedCost ?? undefined })
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <DialogHeader className="mb-4">
        <DialogTitle>Custom activity</DialogTitle>
        <DialogDescription>For anything that isn't in the library.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field data-invalid={(submitted && !!titleError) || undefined}>
          <FieldLabel htmlFor={`${id}-title`}>Title</FieldLabel>
          <Input
            id={`${id}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Picnic in the park"
            autoComplete="off"
            autoFocus
            aria-invalid={(submitted && !!titleError) || undefined}
            aria-describedby={submitted && titleError ? `${id}-title-error` : undefined}
          />
          <FieldError id={`${id}-title-error`}>{submitted && titleError}</FieldError>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor={`${id}-category`}>Category</FieldLabel>
            <CategorySelect id={`${id}-category`} value={category} onChange={setCategory} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-duration`}>Duration</FieldLabel>
            <DurationSelect id={`${id}-duration`} value={duration} onChange={setDuration} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`${id}-location`}>Location</FieldLabel>
          <LocationSelect id={`${id}-location`} value={locationId} onChange={setLocationId} />
        </Field>
        <Field data-invalid={(submitted && !!costError) || undefined}>
          <FieldLabel htmlFor={`${id}-cost`}>
            Estimated cost <span className="font-normal text-muted-foreground">({currency}, optional)</span>
          </FieldLabel>
          <Input
            id={`${id}-cost`}
            inputMode="decimal"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0"
            aria-invalid={(submitted && !!costError) || undefined}
            aria-describedby={submitted && costError ? `${id}-cost-error` : undefined}
          />
          <FieldError id={`${id}-cost-error`}>{submitted && costError}</FieldError>
        </Field>
      </FieldGroup>
      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Add to {targetLabel}</Button>
      </DialogFooter>
    </form>
  )
}
