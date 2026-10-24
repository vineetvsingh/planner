import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CATEGORIES } from "@/lib/plan-meta"
import { formatDuration } from "@/lib/plan-utils"
import { SAMPLE_LOCATIONS } from "@/lib/sample-data"
import { DURATION_PRESETS } from "@/lib/schedule"
import type { ActivityCategory, Minutes } from "@/lib/types"
import { cn } from "@/lib/utils"

const NO_LOCATION = "none"

interface SelectFieldProps<T> {
  id?: string
  value: T
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
}

export function CategorySelect({ id, value, onChange, disabled, className }: SelectFieldProps<ActivityCategory>) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ActivityCategory)} disabled={disabled}>
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(CATEGORIES) as ActivityCategory[]).map((key) => {
          const { label, icon: Icon } = CATEGORIES[key]
          return (
            <SelectItem key={key} value={key}>
              <Icon aria-hidden />
              {label}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

export function DurationSelect({ id, value, onChange, disabled, className }: SelectFieldProps<Minutes>) {
  const options = DURATION_PRESETS.includes(value)
    ? DURATION_PRESETS
    : [...DURATION_PRESETS, value].sort((a, b) => a - b)
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))} disabled={disabled}>
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((m) => (
          <SelectItem key={m} value={String(m)}>
            {formatDuration(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function LocationSelect({
  id,
  value,
  onChange,
  disabled,
  className,
}: SelectFieldProps<string | undefined>) {
  return (
    <Select
      value={value ?? NO_LOCATION}
      onValueChange={(v) => onChange(v === NO_LOCATION ? undefined : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value={NO_LOCATION}>
          <span className="text-muted-foreground">No location</span>
        </SelectItem>
        {SAMPLE_LOCATIONS.map((location) => (
          <SelectItem key={location.id} value={location.id}>
            {location.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

