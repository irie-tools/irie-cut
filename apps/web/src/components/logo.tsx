import { cn } from '#/lib/utils'

/** The Irie Cut mark: timeline clips crossed by a cyan playhead. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={cn('size-7', className)} aria-hidden>
      <rect x="2.5" y="2.5" width="23" height="23" rx="7" className="fill-card stroke-border" strokeWidth="1" />
      <rect x="6.5" y="9" width="11.5" height="3.1" rx="1.55" className="fill-foreground/55" />
      <rect x="9" y="15.8" width="10" height="3.1" rx="1.55" className="fill-foreground/30" />
      <rect x="13.2" y="5.4" width="1.6" height="17.2" rx="0.8" className="fill-primary" />
      <path d="M11.4 5.4 H16.6 L14 8.3 Z" className="fill-primary" />
    </svg>
  )
}

/** Mark + wordmark, used in headers and the footer. */
export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn('flex items-center gap-2 font-semibold', className)}>
      <LogoMark className={markClassName} />
      <span className="tracking-tight">Irie Cut</span>
    </span>
  )
}
