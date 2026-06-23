import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TooltipProvider } from '#/components/ui/tooltip'

export const Route = createRootRoute({ component: RootComponent })

function RootComponent() {
  return (
    <TooltipProvider>
      <Outlet />
    </TooltipProvider>
  )
}
