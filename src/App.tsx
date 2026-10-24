import { createBrowserRouter, RouterProvider } from "react-router"

import { LiveAnnouncer } from "@/components/live-announcer"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useCrossTabSync } from "@/hooks/use-cross-tab-sync"
import { DashboardPage } from "@/pages/dashboard-page"
import { PlanEditorPage, PlanNotFound } from "@/pages/plan-editor-page"
import { PrintPage } from "@/pages/print-page"
import { SharedPlanPage } from "@/pages/shared-plan-page"

const router = createBrowserRouter([
  { path: "/", element: <DashboardPage /> },
  { path: "/plans/:planId", element: <PlanEditorPage /> },
  { path: "/plans/:planId/print", element: <PrintPage /> },
  { path: "/share", element: <SharedPlanPage /> },
  { path: "*", element: <PlanNotFound /> },
])

export default function App() {
  useCrossTabSync()
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={300}>
        <RouterProvider router={router} />
        {/* Bottom-centre keeps toasts off the side panels' action buttons. */}
        <Toaster position="bottom-center" closeButton />
        <LiveAnnouncer />
      </TooltipProvider>
    </ThemeProvider>
  )
}
