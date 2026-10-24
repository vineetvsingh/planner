import { useId, useRef, useState, type FormEvent } from "react"
import { addDays, differenceInCalendarDays, parseISO, startOfToday } from "date-fns"
import { TriangleAlert } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { DateRangeField } from "@/components/plans/date-range-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PLAN_TYPE_ORDER, PLAN_TYPES } from "@/lib/plan-meta"
import { MAX_PLAN_DAYS, PLAN_NAME_MAX, formatClock, toISODate } from "@/lib/plan-utils"
import type { Plan, PlanType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { DEFAULT_SETTINGS, itemsOutsideRange, type PlanInput } from "@/store/plans-store"

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD"]
const TIME_OPTIONS = Array.from({ length: 49 }, (_, i) => i * 30)

interface FormState {
  name: string
  type: PlanType
  range: DateRange | undefined
  dayStart: number
  dayEnd: number
  budget: string
  currency: string
}

type FormErrors = Partial<Record<"name" | "dates" | "hours" | "budget", string>>

function initialState(plan?: Plan): FormState {
  if (plan) {
    return {
      name: plan.name,
      type: plan.type,
      range: { from: parseISO(plan.startDate), to: parseISO(plan.endDate) },
      dayStart: plan.settings.dayStart,
      dayEnd: plan.settings.dayEnd,
      budget: plan.settings.budget?.toString() ?? "",
      currency: plan.settings.currency,
    }
  }
  const today = startOfToday()
  return {
    name: "",
    type: "trip",
    range: { from: today, to: addDays(today, 2) },
    dayStart: DEFAULT_SETTINGS.dayStart,
    dayEnd: DEFAULT_SETTINGS.dayEnd,
    budget: "",
    currency: DEFAULT_SETTINGS.currency,
  }
}

function validate(state: FormState): FormErrors {
  const errors: FormErrors = {}
  const name = state.name.trim()
  if (!name) errors.name = "Give your plan a name."
  else if (name.length > PLAN_NAME_MAX) errors.name = `Keep the name under ${PLAN_NAME_MAX} characters.`

  const { from, to } = state.range ?? {}
  if (!from) errors.dates = "Choose when the plan starts."
  else if (to && differenceInCalendarDays(to, from) + 1 > MAX_PLAN_DAYS) {
    errors.dates = `Plans can cover up to ${MAX_PLAN_DAYS} days.`
  }

  if (state.dayEnd - state.dayStart < 60) errors.hours = "The day must end at least an hour after it starts."

  if (state.budget.trim()) {
    const value = Number(state.budget)
    if (!Number.isFinite(value) || value < 0) errors.budget = "Enter a positive number, or leave it empty."
  }
  return errors
}

interface PlanFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the dialog edits this plan's settings instead of creating one. */
  plan?: Plan
  onSubmit: (input: PlanInput) => void
}

export function PlanFormDialog({ open, onOpenChange, plan, onSubmit }: PlanFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        {/* Remounting on open resets the form to the plan's current values. */}
        {open && <PlanForm plan={plan} onSubmit={onSubmit} onCancel={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function PlanForm({
  plan,
  onSubmit,
  onCancel,
}: {
  plan?: Plan
  onSubmit: (input: PlanInput) => void
  onCancel: () => void
}) {
  const ids = useId()
  const [state, setState] = useState(() => initialState(plan))
  const [submitted, setSubmitted] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const errors = validate(state)
  const shown: FormErrors = submitted ? errors : {}
  const update = (patch: Partial<FormState>) => setState((s) => ({ ...s, ...patch }))

  const startDate = state.range?.from ? toISODate(state.range.from) : undefined
  const endDate = state.range?.from ? toISODate(state.range.to ?? state.range.from) : undefined
  const droppedCount =
    plan && startDate && endDate ? itemsOutsideRange(plan.items, startDate, endDate).length : 0

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(errors).length > 0) {
      if (errors.name) nameRef.current?.focus()
      else document.getElementById(`${ids}-${Object.keys(errors)[0]}`)?.focus()
      return
    }
    const budget = state.budget.trim() ? Number(state.budget) : undefined
    onSubmit({
      name: state.name.trim(),
      type: state.type,
      startDate: startDate!,
      endDate: endDate!,
      settings: { dayStart: state.dayStart, dayEnd: state.dayEnd, budget, currency: state.currency },
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <DialogHeader className="mb-5">
        <DialogTitle>{plan ? "Plan settings" : "Create a plan"}</DialogTitle>
        <DialogDescription>
          {plan
            ? "Change the basics. Your scheduled activities stay where they are."
            : "Start with the basics. You'll add activities in the editor."}
        </DialogDescription>
      </DialogHeader>

      <FieldGroup>
        <Field data-invalid={!!shown.name || undefined}>
          <div className="flex items-baseline justify-between">
            <FieldLabel htmlFor={`${ids}-name`}>Name</FieldLabel>
            <span
              className={cn(
                "text-xs tabular-nums text-muted-foreground",
                state.name.trim().length > PLAN_NAME_MAX && "text-destructive",
              )}
            >
              {state.name.trim().length}/{PLAN_NAME_MAX}
            </span>
          </div>
          <Input
            ref={nameRef}
            id={`${ids}-name`}
            value={state.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="e.g. Weekend in Lisbon"
            autoComplete="off"
            autoFocus
            aria-invalid={!!shown.name || undefined}
            aria-describedby={shown.name ? `${ids}-name-error` : undefined}
          />
          <FieldError id={`${ids}-name-error`}>{shown.name}</FieldError>
        </Field>

        <FieldSet>
          <FieldLegend variant="label">Type</FieldLegend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {PLAN_TYPE_ORDER.map((type) => {
              const meta = PLAN_TYPES[type]
              const Icon = meta.icon
              return (
                <label
                  key={type}
                  className={cn(
                    "flex cursor-pointer flex-col items-start gap-2 rounded-lg border p-2.5 text-sm transition-colors",
                    "hover:bg-muted/60 has-checked:border-primary has-checked:bg-muted/60 has-checked:ring-1 has-checked:ring-primary",
                    "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  )}
                >
                  <input
                    type="radio"
                    name={`${ids}-type`}
                    value={type}
                    checked={state.type === type}
                    onChange={() => update({ type })}
                    className="sr-only"
                  />
                  <span className={cn("grid size-7 place-items-center rounded-md", meta.tile)}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="font-medium">{meta.label}</span>
                </label>
              )
            })}
          </div>
          <FieldDescription>{PLAN_TYPES[state.type].description}.</FieldDescription>
        </FieldSet>

        <Field data-invalid={!!shown.dates || undefined}>
          <FieldLabel htmlFor={`${ids}-dates`}>Dates</FieldLabel>
          <DateRangeField
            id={`${ids}-dates`}
            value={state.range}
            onChange={(range) => update({ range })}
            invalid={!!shown.dates}
            describedBy={shown.dates ? `${ids}-dates-error` : undefined}
          />
          <FieldError id={`${ids}-dates-error`}>{shown.dates}</FieldError>
          {droppedCount > 0 && (
            <p className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {droppedCount === 1
                ? "1 scheduled activity falls outside these dates and will be removed."
                : `${droppedCount} scheduled activities fall outside these dates and will be removed.`}
            </p>
          )}
        </Field>

        <Field data-invalid={!!shown.hours || undefined}>
          <FieldLabel id={`${ids}-hours-label`}>Daily planning hours</FieldLabel>
          <div className="flex items-center gap-2">
            <TimeSelect
              id={`${ids}-hours`}
              label="Day starts"
              value={state.dayStart}
              onChange={(dayStart) => update({ dayStart })}
              options={TIME_OPTIONS.slice(0, -1)}
              invalid={!!shown.hours}
            />
            <span className="text-sm text-muted-foreground">to</span>
            <TimeSelect
              label="Day ends"
              value={state.dayEnd}
              onChange={(dayEnd) => update({ dayEnd })}
              options={TIME_OPTIONS.slice(1)}
              invalid={!!shown.hours}
            />
          </div>
          <FieldDescription>Used to work out free time and progress.</FieldDescription>
          <FieldError>{shown.hours}</FieldError>
        </Field>

        <Field data-invalid={!!shown.budget || undefined}>
          <FieldLabel htmlFor={`${ids}-budget`}>
            Budget <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <div className="flex gap-2">
            <Input
              id={`${ids}-budget`}
              inputMode="decimal"
              value={state.budget}
              onChange={(e) => update({ budget: e.target.value })}
              placeholder="0"
              className="flex-1"
              aria-invalid={!!shown.budget || undefined}
              aria-describedby={shown.budget ? `${ids}-budget-error` : undefined}
            />
            <Select value={state.currency} onValueChange={(currency) => update({ currency })}>
              <SelectTrigger className="w-24" aria-label="Currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <FieldError id={`${ids}-budget-error`}>{shown.budget}</FieldError>
        </Field>
      </FieldGroup>

      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{plan ? "Save changes" : "Create plan"}</Button>
      </DialogFooter>
    </form>
  )
}

function TimeSelect({
  id,
  label,
  value,
  onChange,
  options,
  invalid,
}: {
  id?: string
  label: string
  value: number
  onChange: (value: number) => void
  options: number[]
  invalid?: boolean
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger id={id} className="w-28" aria-label={label} aria-invalid={invalid || undefined}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {options.map((m) => (
          <SelectItem key={m} value={String(m)}>
            {m === 24 * 60 ? "Midnight" : formatClock(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
