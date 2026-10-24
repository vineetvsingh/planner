import { useState } from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"

interface DateRangeFieldProps {
  id: string
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  invalid?: boolean
  describedBy?: string
}

export function DateRangeField({ id, value, onChange, invalid, describedBy }: DateRangeFieldProps) {
  const [open, setOpen] = useState(false)
  const wide = useMediaQuery("(min-width: 640px)")

  let label = "Pick dates"
  if (value?.from && value.to && value.to.getTime() !== value.from.getTime()) {
    label = `${format(value.from, "EEE, MMM d")} – ${format(value.to, "EEE, MMM d, yyyy")}`
  } else if (value?.from) {
    label = format(value.from, "EEE, MMM d, yyyy")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn("w-full justify-start font-normal", !value?.from && "text-muted-foreground")}
        >
          <CalendarIcon data-icon="inline-start" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          required
          selected={value}
          onSelect={onChange}
          defaultMonth={value?.from}
          numberOfMonths={wide ? 2 : 1}
          autoFocus
        />
        <div className="flex items-center justify-between gap-2 border-t p-2">
          <p className="px-1 text-xs text-muted-foreground">
            Pick a single day, or a start and an end day.
          </p>
          <Button size="sm" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
