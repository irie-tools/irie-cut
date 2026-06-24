import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { Logo } from '#/components/logo'
import {
  Clapperboard,
  Scissors,
  Type,
  Layers,
  Download,
  ShieldCheck,
  Upload,
  MousePointer2,
  FileVideo,
} from 'lucide-react'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <Trust />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}

function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
      <Brand />
      <nav className="flex items-center gap-2">
        <a
          href="https://github.com/corey470/irie-cut"
          target="_blank"
          rel="noreferrer"
          className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
        >
          Source
        </a>
        <Button nativeButton={false} render={<Link to="/projects" />}>
          Open the editor
        </Button>
      </nav>
    </header>
  )
}

function Brand() {
  return (
    <Link to="/">
      <Logo className="text-lg" />
    </Link>
  )
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-12 pb-20 lg:pt-20">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" />
            Free · open source · runs in your browser
          </div>
          <h1 className="text-balance font-heading text-5xl font-semibold leading-[1.05] sm:text-6xl">
            Trim, caption, and export your video — without uploading a single file.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Irie Cut is a real video editor that runs entirely on your machine. Drop in
            your clips, cut and layer them on a timeline, add titles, and export an MP4 —
            no account, no watermark, nothing sent to the cloud.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" nativeButton={false} render={<Link to="/projects" />}>
              Start cutting — it's free
            </Button>
            <a
              href="https://github.com/corey470/irie-cut"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              View the source
            </a>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            100% on-device · no sign-up · MIT licensed
          </p>
        </div>

        <EditorPreview />
      </div>
    </section>
  )
}

/**
 * A mockup of the editor surface itself — the hero visual shows the product the
 * visitor is about to use, not decoration.
 */
function EditorPreview() {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-2 shadow-2xl ring-1 ring-white/5">
      {/* window chrome */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span className="size-2.5 rounded-full bg-red-500/70" />
        <span className="size-2.5 rounded-full bg-yellow-500/70" />
        <span className="size-2.5 rounded-full bg-green-500/70" />
        <span className="ml-2 text-[11px] text-muted-foreground">Irie Cut — Summer reel</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        {/* preview canvas */}
        <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-sky-500 via-fuchsia-500 to-amber-400">
          <span className="font-heading text-2xl font-bold text-white drop-shadow-lg sm:text-3xl">
            Your title here
          </span>
        </div>
        {/* timeline */}
        <div className="space-y-1.5 bg-background/80 p-2">
          <div className="h-5 rounded bg-amber-500/80" style={{ width: '55%' }} />
          <div className="flex gap-1.5">
            <div className="h-5 rounded bg-sky-600/80" style={{ width: '40%' }} />
            <div className="h-5 rounded bg-violet-600/80" style={{ width: '35%' }} />
          </div>
          <div className="h-5 rounded bg-emerald-600/70" style={{ width: '70%' }} />
        </div>
      </div>
    </div>
  )
}

const STEPS = [
  {
    icon: Upload,
    title: 'Drop in your clips',
    body: 'Import video, audio and images straight from your device. They load instantly and stay local.',
  },
  {
    icon: MousePointer2,
    title: 'Cut and layer on the timeline',
    body: 'Trim edges, split at the playhead, layer titles over footage, and arrange clips across tracks.',
  },
  {
    icon: FileVideo,
    title: 'Export an MP4',
    body: 'Render the timeline to a finished video in the browser. What you see is exactly what downloads.',
  },
]

function HowItWorks() {
  return (
    <section className="border-t border-border bg-card/20">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-heading text-3xl font-semibold">From raw clips to a finished cut</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Three steps, start to finish — and every one of them happens on your own machine.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative rounded-xl border border-border bg-card p-6">
              <span className="absolute right-5 top-5 font-heading text-3xl font-semibold text-muted-foreground/20">
                {i + 1}
              </span>
              <s.icon className="mb-4 size-7 text-primary" />
              <h3 className="font-medium">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const FEATURES = [
  {
    icon: Layers,
    title: 'Multi-track timeline',
    body: 'Stack video, images, audio and text on independent tracks. Drag to move, grab an edge to trim, split at the playhead.',
  },
  {
    icon: Type,
    title: 'Titles & captions',
    body: 'Drop styled text anywhere on the frame — pick the font size, color, alignment and position, and place it exactly when you want.',
  },
  {
    icon: Scissors,
    title: 'Precise cutting',
    body: 'Scrub to the frame, split a clip in two, duplicate it, or delete it. Keyboard shortcuts keep your hands on the edit.',
  },
  {
    icon: Download,
    title: 'Real in-browser export',
    body: 'Render your timeline — video, overlays and mixed audio — to a downloadable MP4 without ever leaving the page.',
  },
]

function Features() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <h2 className="font-heading text-3xl font-semibold">Everything you need to make the cut</h2>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
          >
            <f.icon className="mb-4 size-7 text-primary" />
            <h3 className="font-medium">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Trust() {
  return (
    <section className="border-y border-border bg-card/20">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 sm:grid-cols-3">
        <div>
          <ShieldCheck className="mb-3 size-7 text-primary" />
          <h3 className="font-medium">Your media never leaves your device</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Files are stored locally and every frame is rendered on-device. There is no
            server to upload to — by design.
          </p>
        </div>
        <div>
          <Clapperboard className="mb-3 size-7 text-primary" />
          <h3 className="font-medium">No account, no watermark</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Open the editor and start. Exports come out clean — no badge stamped across
            your work, no sign-up wall in the way.
          </p>
        </div>
        <div>
          <Star className="mb-3 size-7 text-primary" />
          <h3 className="font-medium">Open source, MIT licensed</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            The whole editor is open. Read it, fork it, build on it — Irie Cut is yours to
            keep and to extend.
          </p>
        </div>
      </div>
    </section>
  )
}

function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 18.6 6.1 21.3l1.2-6.6L2.5 9.5l6.6-.9L12 2.5z" />
    </svg>
  )
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h2 className="text-balance font-heading text-4xl font-semibold">
        Ready to make the cut?
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
        Open the editor and start your first project. No download, no account — just you and
        your footage.
      </p>
      <div className="mt-8">
        <Button size="lg" nativeButton={false} render={<Link to="/projects" />}>
          Start cutting — it's free
        </Button>
      </div>
    </section>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
        <Brand />
        <span>MIT licensed · built in the browser · your media stays yours.</span>
      </div>
    </footer>
  )
}
