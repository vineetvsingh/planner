import { useId, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PLAN_NAME_MAX } from "@/lib/plan-utils"

interface RenamePlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentName: string
  onRename: (name: string) => void
}

export function RenamePlanDialog({ open, onOpenChange, currentName, onRename }: RenamePlanDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <RenameForm currentName={currentName} onRename={onRename} onCancel={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function RenameForm({
  currentName,
  onRename,
  onCancel,
}: {
  currentName: string
  onRename: (name: string) => void
  onCancel: () => void
}) {
  const id = useId()
  const [name, setName] = useState(currentName)
  const [submitted, setSubmitted] = useState(false)

  const trimmed = name.trim()
  const error = !trimmed
    ? "The name can't be empty."
    : trimmed.length > PLAN_NAME_MAX
      ? `Keep the name under ${PLAN_NAME_MAX} characters.`
      : undefined
  const shownError = submitted ? error : undefined

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (error) return
    if (trimmed === currentName) onCancel()
    else onRename(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <DialogHeader className="mb-4">
        <DialogTitle>Rename plan</DialogTitle>
        <DialogDescription className="sr-only">Enter a new name for “{currentName}”.</DialogDescription>
      </DialogHeader>
      <Field data-invalid={!!shownError || undefined}>
        <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          autoFocus
          autoComplete="off"
          aria-invalid={!!shownError || undefined}
          aria-describedby={shownError ? `${id}-error` : undefined}
        />
        <FieldError id={`${id}-error`}>{shownError}</FieldError>
      </Field>
      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Rename</Button>
      </DialogFooter>
    </form>
  )
}
