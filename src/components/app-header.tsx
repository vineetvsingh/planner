import type { ReactNode } from "react"
import { Blocks } from "lucide-react"
import { Link } from "react-router"

import { SaveIndicator } from "@/components/save-indicator"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

/** Top bar shared by every screen. `children` fills the middle (e.g. the editor's plan title). */
export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/75">
      <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-6">
        {/* Inside a plan the back button already leads home, so phones skip the logo to make room for the title. */}
        <Link
          to="/"
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-md font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            children && "max-sm:hidden",
          )}
        >
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <Blocks className="size-4" aria-hidden />
          </span>
          <span className={children ? "hidden md:inline" : undefined}>Plan Composer</span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
        <SaveIndicator />
        <ThemeToggle />
      </div>
    </header>
  )
}
