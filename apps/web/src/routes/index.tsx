import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { Logo } from '#/components/logo'
import {
  Music,
  Sparkles,
  Scissors,
  Layers,
  Type,
  Download,
  Wand2,
  ShieldCheck,
  Code,
  Heart,
} from 'lucide-react'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="min-h-screen" style={{ fontFamily: "'Space Grotesk Variable', sans-serif" }}>
      <SiteHeader />
      <main>
        <Hero />
        <BeatCut />
        <RealEditor />
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
      <Button className="energy-cta" nativeButton={false} render={<Link to="/projects" />}>
        Open the editor
      </Button>
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

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-display text-sm uppercase tracking-[0.22em] text-primary">{children}</p>
  )
}

/** Big marquee display heading. Bebas renders as poster caps — the festival voice. */
function Display({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <h2 className={`font-display leading-[0.92] ${className}`}>{children}</h2>
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* energy haze behind the hero */}
      <div
        className="energy-haze pointer-events-none absolute -top-32 left-1/2 size-[640px] -translate-x-1/2 rounded-full opacity-60"
        style={{
          background:
            'radial-gradient(circle, rgba(244,184,41,0.18), rgba(255,82,54,0.12) 40%, transparent 68%)',
          animation: 'glow-pulse 6s ease-in-out infinite',
        }}
      />
      <div className="relative mx-auto max-w-6xl px-6 pt-8 pb-20 lg:pt-12">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/[0.07] px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              Free · open source · on-device
            </div>
            <Display className="text-6xl sm:text-7xl">
              Your footage.
              <br />
              Your machine.
              <br />
              <span className="energy-text">Cut to the beat.</span>
            </Display>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              A real in-browser video editor — multi-track timeline, effects, captions, and a
              beat-cutter that lays your clips to the music automatically. No account, nothing
              uploaded, every frame rendered right here on your machine.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                size="lg"
                className="energy-cta w-full font-display text-lg tracking-wider sm:w-auto"
                nativeButton={false}
                render={<Link to="/projects" />}
              >
                Start cutting
              </Button>
              <a
                href="#beat-cut"
                className="text-center text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                See how it works
              </a>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">
              100% on-device · no sign-up · MIT licensed
            </p>
          </div>

          <EditorReel />
        </div>
      </div>
    </section>
  )
}

/**
 * The hero visual: a real screen-recording of the Irie Cut editor running a
 * beat-cut (poster paints instantly, the muted loop autoplays). Recorded by
 * driving the real editor; re-record any time and drop new files in public/.
 */
function EditorReel() {
  return (
    <div className="rounded-xl border border-primary/15 bg-card/70 p-2 shadow-2xl ring-1 ring-primary/5">
      <div className="overflow-hidden rounded-lg border border-border">
        <video
          className="block w-full"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/hero-poster.jpg"
        >
          <source src="/hero.webm" type="video/webm" />
          <source src="/hero.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="flex items-center gap-2 px-1 pt-2 text-[11px] text-muted-foreground">
        <span className="ml-auto">the real editor, cutting to the beat</span>
      </div>
    </div>
  )
}

function BeatCut() {
  return (
    <section id="beat-cut" className="mx-auto max-w-6xl scroll-mt-6 px-6 py-20">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <Eyebrow>The beat-cut</Eyebrow>
          <Display className="mt-2 text-4xl sm:text-5xl">Clips and stills, cut to the music.</Display>
          <p className="mt-4 text-muted-foreground">
            Drop a few images or clips and a song on the timeline, and Irie Cut cuts between them on
            the beat — never a static frame, never a loop stretched thin. Pick the cadence and it
            re-cuts in one click.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              { icon: Sparkles, t: 'Lands every cut on the beat', d: 'Pick the cadence — every beat, every two, every four — and re-cut in one click.' },
              { icon: Wand2, t: 'Motion on the stills', d: 'A slow Ken-Burns push keeps images alive instead of sitting flat on screen.' },
              { icon: Download, t: 'Every platform size at once', d: 'Auto-reframe to 9:16, 1:1, 16:9 and 4:5 — no re-editing by hand.' },
            ].map((f) => (
              <li key={f.t} className="flex gap-3">
                <f.icon className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">{f.t}</p>
                  <p className="text-sm text-muted-foreground">{f.d}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Button className="energy-cta font-display tracking-wider" nativeButton={false} render={<Link to="/projects" />}>
              Make a beat-cut
            </Button>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card/60 p-5">
          <div>
            <p className="font-display mb-2 text-sm uppercase tracking-[0.2em] text-muted-foreground">A loop, on repeat</p>
            <div className="flex gap-0.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-7 flex-1 rounded-sm bg-muted" />
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">one clip stretched over the whole song — reads as filler.</p>
          </div>
          <div>
            <p className="font-display mb-2 text-sm uppercase tracking-[0.2em] text-primary">Cut to the beat</p>
            <div className="flex gap-0.5">
              {[15, 13, 13, 17, 13, 29].map((w, i) => (
                <div
                  key={i}
                  className="h-7 rounded-sm"
                  style={{ width: `${w}%`, background: ['#f4b829', '#ff5236', '#25c281', '#f4b829', '#ff5236', '#25c281'][i], opacity: 0.85 }}
                />
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">clips landing on every beat — reads as intentional.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

const FEATURES = [
  { icon: Layers, title: 'Multi-track timeline', body: 'Stack video, images, audio and text on independent tracks. Drag to move, grab an edge to trim, split at the playhead.' },
  { icon: Type, title: 'Titles & captions', body: 'Drop styled text anywhere on the frame, or turn synced lyrics into burned-in captions sized for a muted feed.' },
  { icon: Scissors, title: 'Precise cutting', body: 'Scrub to the frame, split a clip in two, duplicate, ripple-delete. Keyboard shortcuts keep your hands on the edit.' },
  { icon: Download, title: 'Real in-browser export', body: 'Render the timeline — video, overlays and mixed audio — to a downloadable MP4 without ever leaving the page.' },
]

function RealEditor() {
  return (
    <section className="border-t border-border bg-card/20">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <Eyebrow>Not a toy</Eyebrow>
        <Display className="mt-2 text-4xl sm:text-5xl">And it&apos;s a real editor underneath.</Display>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          The beat-cut is the fast lane. When you want to get in by hand, the full editor is right
          there — frame-accurate, multi-track, and rendered entirely on your device.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40">
              <f.icon className="mb-4 size-7 text-primary" />
              <h3 className="font-display text-2xl tracking-wide">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Trust() {
  const items = [
    { icon: ShieldCheck, t: 'Your media never leaves your device', d: 'Files are stored locally and every frame is rendered on-device. There is no server to upload to — by design.' },
    { icon: Sparkles, t: 'No account, no watermark', d: 'Open the editor and start. Exports come out clean — no badge stamped across your work, no sign-up wall.' },
    { icon: Code, t: 'Open source, MIT licensed', d: 'Read the code, self-host it, or build on it — the whole editor is on GitHub.' },
  ]
  return (
    <section className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.t}>
            <it.icon className="mb-3 size-7 text-primary" />
            <h3 className="font-display text-xl tracking-wide">{it.t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{it.d}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-border">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(255,82,54,0.12), rgba(37,194,129,0.08) 45%, transparent 70%)', animation: 'glow-pulse 7s ease-in-out infinite' }}
      />
      <div className="relative mx-auto max-w-3xl px-6 py-24 text-center">
        <Display className="text-5xl sm:text-6xl">
          Make your <span className="energy-text">first cut.</span>
        </Display>
        <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
          Open the editor and start a project. No download, no account — just you, your song, and
          your footage.
        </p>
        <div className="mt-8">
          <Button size="lg" className="energy-cta font-display text-lg tracking-wider" nativeButton={false} render={<Link to="/projects" />}>
            Start cutting
          </Button>
        </div>
      </div>
    </section>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/20">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Brand />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              A free, open, in-browser video editor — cut, layer, and export, entirely on your
              machine.
            </p>
          </div>

          <div>
            <p className="font-display text-sm uppercase tracking-[0.2em] text-primary">The editor</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Layers className="size-4 text-primary" /> Multi-track timeline</li>
              <li className="flex items-center gap-2"><Music className="size-4 text-primary" /> Beat-cut &amp; audio mixing</li>
              <li className="flex items-center gap-2"><Scissors className="size-4 text-primary" /> Precise, on-device cutting</li>
            </ul>
          </div>

          <div>
            <p className="font-display text-sm uppercase tracking-[0.2em] text-primary">Open source</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href="https://github.com/irie-tools/irie-cut" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
                  <Code className="size-4" /> Source on GitHub
                </a>
              </li>
              <li>
                <a href="https://github.com/irie-tools/irie-cut/issues" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
                  <Sparkles className="size-4" /> Report an issue
                </a>
              </li>
              <li className="text-muted-foreground">MIT licensed</li>
            </ul>
          </div>

          <div>
            <p className="font-display text-sm uppercase tracking-[0.2em] text-primary">The promise</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>100% on-device</li>
              <li>No account, ever</li>
              <li>No watermark on your work</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <span className="inline-flex items-center gap-1.5">
            Built in the browser with <Heart className="size-3.5 text-primary" />, free and open.
          </span>
          <span>Your media stays on your machine.</span>
        </div>
      </div>
    </footer>
  )
}
