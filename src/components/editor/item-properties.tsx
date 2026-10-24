import { useId, useState } from "react"
import { format, parseISO } from "date-fns"
import { CalendarClock, Copy, Trash2, TriangleAlert, X } from "lucide-react"

import { CategorySelect, DurationSelect, LocationSelect } from "@/components/editor/activity-fields"
import { PanelHeading } from "@/components/editor/panel-heading"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatClock, parseCost, planDays } from "@/lib/plan-utils"
import { START_TIME_OPTIONS } from "@/lib/schedule"
import { describeConflictFor, suggestSlot, type Conflict } from "@/lib/schedule-analysis"
import type { Activity, Plan, ScheduledItem } from "@/lib/types"
import { usePlansStore, type ItemPatch } from "@/store/plans-store"

const TITLE_MAX = 80

interface ItemPropertiesProps {
  plan: Plan
  item: ScheduledItem
  activity: Activity
  /** Scheduling problems involving this item. */
  conflicts: Conflict[]
  readOnly: boolean
  /** Moves the item to the nearest free slot. */
  onFix: () => void
  onClose: () => void
  onDuplicate: () => void
  onRemove: () => void
}

/**
 * Edits apply as you make them (and are undoable). Text fields keep a local draft so
 * invalid input, like an empty title, never reaches the plan.
 */
export function ItemProperties({
  plan,
  item,
  activity,
  conflicts,
  readOnly,
  onFix,
  onClose,
  onDuplicate,
  onRemove,
}: ItemPropertiesProps) {
  const id = useId()
  const updateItem = usePlansStore((s) => s.updateItem)
  const [titleDraft, setTitleDraft] = useState<string | null>(null)
  const [costDraft, setCostDraft] = useState<string | null>(null)

  const update = (patch: ItemPatch, coalesceKey?: string) => updateItem(plan.id, item.id, patch, coalesceKey)

  const title = titleDraft ?? activity.title
  const trimmedTitle = title.trim()
  const titleError = !trimmedTitle
    ? "The title can't be empty."
    : trimmedTitle.length > TITLE_MAX
      ? `Keep the title under ${TITLE_MAX} characters.`
      : undefined

  const cost = costDraft ?? activity.cost?.toString() ?? ""
  const costError = parseCost(cost) === null ? "Enter a positive number, or leave it empty." : undefined

  const end = item.startTime + item.duration
  const days = planDays(plan)
  const suggestion = conflicts.length > 0 && !readOnly ? suggestSlot(plan, item.id) : null
  const suggestionLabel =
    suggestion &&
    (suggestion.date === item.date
      ? formatClock(suggestion.startTime)
      : `Day ${days.indexOf(suggestion.date) + 1}, ${formatClock(suggestion.startTime)}`)

  return (
    <div className="bg-background">
      <PanelHeading
        title="Activity"
        description="Changes save as you go."
        actions={
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close activity details">
            <X />
          </Button>
        }
      />
      <FieldGroup className="gap-4 p-4">
        <Field data-invalid={!!titleError || undefined}>
          <FieldLabel htmlFor={`${id}-title`}>Title</FieldLabel>
          <Input
            id={`${id}-title`}
            value={title}
            disabled={readOnly}
            autoComplete="off"
            onChange={(e) => {
              const value = e.target.value
              setTitleDraft(value)
              const trimmed = value.trim()
              if (trimmed && trimmed.length <= TITLE_MAX) update({ activity: { title: trimmed } }, `title:${item.id}`)
            }}
            onBlur={() => setTitleDraft(null)}
            aria-invalid={!!titleError || undefined}
            aria-describedby={titleError ? `${id}-title-error` : undefined}
          />
          <FieldError id={`${id}-title-error`}>
            {titleError && `${titleError} Leaving the field keeps “${activity.title}”.`}
          </FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor={`${id}-category`}>Category</FieldLabel>
          <CategorySelect
            id={`${id}-category`}
            value={activity.category}
            onChange={(category) => update({ activity: { category } })}
            disabled={readOnly}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={`${id}-day`}>Day</FieldLabel>
          <Select value={item.date} onValueChange={(date) => update({ item: { date } })} disabled={readOnly}>
            <SelectTrigger id={`${id}-day`} className="w-full">
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
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor={`${id}-start`}>Starts</FieldLabel>
            <Select
              value={String(item.startTime)}
              onValueChange={(v) => update({ item: { startTime: Number(v) } })}
              disabled={readOnly}
            >
              <SelectTrigger id={`${id}-start`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {(START_TIME_OPTIONS.includes(item.startTime)
                  ? START_TIME_OPTIONS
                  : [...START_TIME_OPTIONS, item.startTime].sort((a, b) => a - b)
                ).map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {formatClock(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-duration`}>Duration</FieldLabel>
            <DurationSelect
              id={`${id}-duration`}
              value={item.duration}
              onChange={(duration) => update({ item: { duration } })}
              disabled={readOnly}
            />
          </Field>
        </div>
        <div className="-mt-2 space-y-2" aria-live="polite">
          <FieldDescription>Ends at {formatClock(end % (24 * 60))}{end > 24 * 60 && " the next day"}.</FieldDescription>
          {conflicts.length > 0 && (
            <div className="space-y-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
              <ul className="space-y-1">
                {conflicts.map((conflict) => (
                  <li key={conflict.key} className="flex items-start gap-2">
                    <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                    {describeConflictFor(plan, conflict, item.id)}
                  </li>
                ))}
              </ul>
              {suggestionLabel && (
                <Button size="xs" variant="outline" className="bg-background" onClick={onFix}>
                  <CalendarClock data-icon="inline-start" />
                  Move to {suggestionLabel}
                </Button>
              )}
            </div>
          )}
        </div>

        <Field>
          <FieldLabel htmlFor={`${id}-location`}>Location</FieldLabel>
          <LocationSelect
            id={`${id}-location`}
            value={activity.locationId}
            onChange={(locationId) => update({ activity: { locationId } })}
            disabled={readOnly}
          />
        </Field>

        <Field data-invalid={!!costError || undefined}>
          <FieldLabel htmlFor={`${id}-cost`}>
            Estimated cost <span className="font-normal text-muted-foreground">({plan.settings.currency})</span>
          </FieldLabel>
          <Input
            id={`${id}-cost`}
            inputMode="decimal"
            value={cost}
            placeholder="0"
            disabled={readOnly}
            onChange={(e) => {
              setCostDraft(e.target.value)
              const parsed = parseCost(e.target.value)
              if (parsed !== null) update({ activity: { cost: parsed } }, `cost:${item.id}`)
            }}
            onBlur={() => setCostDraft(null)}
            aria-invalid={!!costError || undefined}
            aria-describedby={costError ? `${id}-cost-error` : undefined}
          />
          <FieldError id={`${id}-cost-error`}>{costError}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor={`${id}-notes`}>Notes</FieldLabel>
          <Textarea
            id={`${id}-notes`}
            value={activity.notes ?? ""}
            placeholder="Tickets, addresses, reminders…"
            disabled={readOnly}
            rows={3}
            onChange={(e) => update({ activity: { notes: e.target.value || undefined } }, `notes:${item.id}`)}
          />
        </Field>
      </FieldGroup>

      <div className="flex gap-2 border-t p-4">
        <Button variant="outline" size="sm" onClick={onDuplicate} disabled={readOnly}>
          <Copy data-icon="inline-start" />
          Duplicate
        </Button>
        <Button variant="destructive" size="sm" onClick={onRemove} disabled={readOnly} className="ml-auto">
          <Trash2 data-icon="inline-start" />
          Remove
        </Button>
      </div>
    </div>
  )
}
