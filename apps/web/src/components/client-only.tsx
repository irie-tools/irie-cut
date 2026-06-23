import { useEffect, useState, type ReactNode } from 'react'

/**
 * Renders children only after hydration. The editor relies on browser-only
 * APIs (IndexedDB, canvas, MediaRecorder) that must not run during SSR.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return <>{mounted ? children : fallback}</>
}
