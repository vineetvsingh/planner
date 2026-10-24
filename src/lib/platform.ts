export const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)

/** Label for the primary shortcut modifier: ⌘ on Apple devices, Ctrl elsewhere. */
export const MOD_KEY = IS_MAC ? "⌘" : "Ctrl"
