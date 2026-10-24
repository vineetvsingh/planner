import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { Preferences, ViewMode } from "@/lib/types"
import { reportingStorage } from "@/store/save-status"

/** Pixel heights of one hour on the timeline. */
export const TIMELINE_ZOOM = { compact: 44, comfortable: 64, spacious: 96 } as const
export type TimelineZoom = keyof typeof TIMELINE_ZOOM

interface PreferencesState extends Preferences {
  setDefaultView: (view: ViewMode) => void
  setHourHeight: (height: number) => void
  setDistanceUnit: (unit: Preferences["distanceUnit"]) => void
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      timeFormat: "24h",
      hourHeight: TIMELINE_ZOOM.comfortable,
      distanceUnit: "km",
      defaultView: "timeline",
      setDefaultView: (defaultView) => set({ defaultView }),
      setHourHeight: (hourHeight) => set({ hourHeight }),
      setDistanceUnit: (distanceUnit) => set({ distanceUnit }),
    }),
    {
      name: "plan-composer:preferences",
      version: 1,
      storage: createJSONStorage(() => reportingStorage),
      partialize: ({ timeFormat, hourHeight, distanceUnit, defaultView }) => ({
        timeFormat,
        hourHeight,
        distanceUnit,
        defaultView,
      }),
    },
  ),
)
