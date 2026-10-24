import { create } from "zustand"
import type { StateStorage } from "zustand/middleware"

type SaveState =
  | { status: "idle" }
  | { status: "saved"; at: number }
  | { status: "error"; message: string }

export const useSaveStatus = create<SaveState>(() => ({ status: "idle" }))

export type RecoveryNotice =
  /** Saved data couldn't be read at all; it was set aside under `backupKey`. */
  | { kind: "unreadable"; backupKey: string }
  /** Some plans were dropped or partly repaired on load; the original was set aside. */
  | { kind: "repaired"; backupKey: string; dropped: number; repaired: number }

/** Shown once on the dashboard after loading damaged data, until dismissed. */
export const useRecoveryNotice = create<{ notice: RecoveryNotice | null }>(() => ({ notice: null }))

/**
 * Copies damaged saved data to a separate key before the app overwrites it, so nothing
 * is lost for good. Returns the key, or null if storage refused.
 */
export function setAsideDamagedData(name: string, raw: string): string | null {
  const key = `${name}:damaged-${new Date().toISOString().replace(/[:.]/g, "-")}`
  try {
    localStorage.setItem(key, raw)
    return key
  } catch {
    return null
  }
}

/**
 * localStorage wrapper that never throws and reports whether the last write landed,
 * so the UI can show "Saved" or a recoverable failure instead of silently losing edits.
 */
export const reportingStorage: StateStorage = {
  getItem: (name) => {
    let raw: string | null
    try {
      raw = localStorage.getItem(name)
    } catch {
      return null
    }
    if (raw === null) return null
    try {
      JSON.parse(raw)
      return raw
    } catch {
      // Unparseable: keep a copy and start fresh rather than failing to load at all.
      const backupKey = setAsideDamagedData(name, raw)
      if (backupKey) useRecoveryNotice.setState({ notice: { kind: "unreadable", backupKey } })
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
      useSaveStatus.setState({ status: "saved", at: Date.now() })
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "QuotaExceededError"
          ? "Browser storage is full."
          : "Browser storage is unavailable."
      useSaveStatus.setState({ status: "error", message })
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      // Nothing to recover; the next successful write overwrites it.
    }
  },
}
