import { useEffect } from "react"
import { toast } from "sonner"

import { usePlansStore } from "@/store/plans-store"
import { usePreferences } from "@/store/preferences-store"

/**
 * Keeps tabs in step: when another tab saves, reload from storage instead of letting
 * this tab's next save overwrite those changes.
 */
export function useCrossTabSync() {
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === "plan-composer") {
        void Promise.resolve(usePlansStore.persist.rehydrate()).then(() => {
          // Undo steps from before the reload would resurrect the other tab's overwritten state.
          usePlansStore.setState({ history: {} })
          if (document.visibilityState === "visible") {
            toast("Updated with changes from another tab", { id: "cross-tab-sync" })
          }
        })
      } else if (event.key === "plan-composer:preferences") {
        void usePreferences.persist.rehydrate()
      }
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])
}
