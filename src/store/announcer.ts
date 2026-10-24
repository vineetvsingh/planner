import { create } from "zustand"

interface AnnouncerState {
  message: string
  /** Bumped on every call so repeating the same message is still announced. */
  key: number
}

export const useAnnouncer = create<AnnouncerState>(() => ({ message: "", key: 0 }))

/** Reads `message` aloud to screen-reader users without moving focus. */
export function announce(message: string) {
  useAnnouncer.setState((s) => ({ message, key: s.key + 1 }))
}
