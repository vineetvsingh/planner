import { createContext, useContext } from "react"

import type { Placement } from "@/lib/timeline"
import type { ISODate } from "@/lib/types"
import type { ActivityTemplate } from "@/store/plans-store"

/** What is being dragged. */
export type DragData =
  | { kind: "library"; template: ActivityTemplate }
  | { kind: "item"; itemId: string }

/** Where it can be dropped. */
export type DropData = { kind: "timeline-day"; date: ISODate } | { kind: "list-day"; date: ISODate }

export interface DropPreview extends Placement {
  view: DropData["kind"]
  /** The drop would leave things exactly as they are. */
  unchanged: boolean
}

export interface DragState {
  dragging: DragData | null
  preview: DropPreview | null
}

export const DragStateContext = createContext<DragState>({ dragging: null, preview: null })

export function useDragState(): DragState {
  return useContext(DragStateContext)
}
