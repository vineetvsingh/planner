import { useSyncExternalStore } from "react"

import { usePlansStore } from "@/store/plans-store"

/** True once saved plans have been restored from storage. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => usePlansStore.persist.onFinishHydration(onChange),
    () => usePlansStore.persist.hasHydrated(),
    () => false,
  )
}
