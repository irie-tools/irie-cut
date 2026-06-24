import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { Logo } from '#/components/logo'
import {
  Music,
  Film,
  Sparkles,
  Share2,
  Scissors,
  Layers,
  Type,
  Download,
  Captions,
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
        <Pipeline />
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
              Part of the Irie ecosystem · free · on-device
            </div>
            <Display className="text-6xl sm:text-7xl">
              Your song.
              <br />
              Your visuals.
              <br />
              <span className="energy-text">Cut to the beat.</span>
            </Display>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Irie Cut is the cutting room of your Irie studio. Bring cover art from{' '}
              <span className="text-foreground">Pam</span> or clips from{' '}
              <span className="text-foreground">Video Studio</span>, drop in the track, and it lays
              them to the beat — captioned and sized for every platform. All on your machine.
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
                href="#pipeline"
                className="text-center text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                See how it works
              </a>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">
              100% on-device · no sign-up · MIT licensed
            </p>
          </div>

          <AnimatedBeatCut />
        </div>
      </div>
    </section>
  )
}

/**
 * The hero visual, alive: cover art in motion, an equalizer pulsing, segments
 * popping on the beat, and a playhead sweeping the timeline. This whole preview
 * is one block — swap it for a <video autoplay muted loop playsinline> of the
 * real editor running and the rest of the hero stays put.
 */
function AnimatedBeatCut() {
  const segs = [
    { w: 15, c: '#f4b829' },
    { w: 13, c: '#ff5236' },
    { w: 13, c: '#25c281' },
    { w: 17, c: '#f4b829' },
    { w: 13, c: '#ff5236' },
    { w: 29, c: '#25c281' },
  ]
  const ticks: number[] = []
  let acc = 0
  for (const s of segs.slice(0, -1)) {
    acc += s.w
    ticks.push(acc)
  }
  const eq = [0.2, 0.5, 0.1, 0.7, 0.3, 0.6, 0.15]

  return (
    <div className="rounded-xl border border-primary/15 bg-card/70 p-2 shadow-2xl ring-1 ring-primary/5">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span className="size-2.5 rounded-full bg-[#ff5236]/70" />
        <span className="size-2.5 rounded-full bg-[#f4b829]/70" />
        <span className="size-2.5 rounded-full bg-[#25c281]/70" />
        <span className="ml-2 text-[11px] text-muted-foreground">Irie Cut — Tour teaser</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        {/* the "screen" — replace with <video> later */}
        <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-gradient-to-br from-[#2a1f14] via-[#1a130d] to-black">
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 35%, rgba(244,184,41,0.22), transparent 60%)',
              animation: 'glow-pulse 4s ease-in-out infinite',
            }}
          />
          <div className="relative text-center">
            <span className="font-display block text-4xl text-foreground sm:text-5xl">Drift Me Home</span>
            <span className="mt-1 block text-[11px] uppercase tracking-[0.28em] text-primary">
              new single · out now
            </span>
          </div>
          {/* equalizer */}
          <div className="absolute bottom-3 left-1/2 flex h-8 -translate-x-1/2 items-end gap-1">
            {eq.map((d, i) => (
              <span
                key={i}
                className="eq-bar w-1.5 rounded-full bg-primary/80"
                style={{ height: '100%', transformOrigin: 'bottom', animation: `eq-bar 0.9s ease-in-out ${d}s infinite` }}
              />
            ))}
          </div>
        </div>

        {/* the beat-cut timeline */}
        <div className="relative bg-background/80 p-3">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute top-2 bottom-2 w-px bg-primary/40"
              style={{ left: `calc(0.75rem + ${t}% * (100% - 1.5rem) / 100)` }}
            />
          ))}
          {/* sweeping playhead */}
          <span
            className="playhead absolute top-1 bottom-1 w-0.5 rounded bg-foreground"
            style={{ animation: 'playhead-sweep 3.2s ease-in-out infinite alternate' }}
          />
          <div className="flex gap-0.5">
            {segs.map((s, i) => (
              <div
                key={i}
                className="beat-seg h-7 rounded-sm"
                style={{
                  width: `${s.w}%`,
                  background: s.c,
                  opacity: 0.85,
                  transformOrigin: 'bottom',
                  animation: `beat-pop 1.6s ease-in-out ${i * 0.18}s infinite`,
                }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex h-7 items-center gap-[2px] rounded-sm bg-secondary/60 px-1.5">
            {[3, 6, 4, 8, 5, 9, 6, 11, 7, 5, 9, 13, 8, 6, 10, 7, 12, 8, 5, 9, 7, 11, 6, 9, 5, 8, 12, 7, 6, 10, 8, 5, 9, 7, 11, 6, 8, 5, 7, 4].map((h, i) => (
              <span key={i} className="w-[2px] flex-1 rounded-full bg-foreground/35" style={{ height: `${(h / 13) * 100}%` }} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-1 pt-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary/70 px-2 py-0.5">
          <Music className="size-3 text-primary" /> from Pam
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary/70 px-2 py-0.5">
          <Film className="size-3 text-primary" /> from Video Studio
        </span>
        <span className="ml-auto">cut to the beat</span>
      </div>
    </div>
  )
}

const PIPELINE = [
  {
    icon: Music,
    title: 'Made upstream',
    body: 'Pam writes the song and the cover art. Video Studio makes the cinematic clips. Both hand off to Irie Cut in a single file — no re-uploading, no re-exporting.',
  },
  {
    icon: Sparkles,
    title: 'Cut to the beat here',
    body: 'Open the handoff and your covers and clips land on the beat automatically — Ken-Burns motion on the stills, burned-in captions, the whole promo assembled and ready to trim.',
  },
  {
    icon: Share2,
    title: 'Out to every platform',
    body: 'Export 9:16, 1:1, 16:9 and 4:5 in one pass. Clean files, no watermark, no account — ready to post the day the single drops.',
  },
]

function Pipeline() {
  return (
    <section id="pipeline" className="scroll-mt-6 border-t border-border bg-card/20">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <Eyebrow>The release pipeline</Eyebrow>
        <Display className="mt-2 text-4xl sm:text-5xl">From a finished song to a posted promo.</Display>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Irie Cut is the back half of the release. The making happens upstream in your studio; the
          cutting and finishing happen here — and nothing ever leaves your machine.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PIPELINE.map((s, i) => (
            <div key={s.title} className="relative rounded-xl border border-border bg-card p-6">
              <span className="font-display absolute right-5 top-4 text-4xl text-primary/25">{i + 1}</span>
              <s.icon className="mb-4 size-7 text-primary" />
              <h3 className="font-display text-2xl tracking-wide">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function BeatCut() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <Eyebrow>The beat-cut</Eyebrow>
          <Display className="mt-2 text-4xl sm:text-5xl">Cover variations and clips, cut to the music.</Display>
          <p className="mt-4 text-muted-foreground">
            Send three cover variations and a song and Irie Cut flips between them on the beat —
            never a static frame, never a 15-second loop on repeat. Bring motion clips from Video
            Studio and the same cutter lays those to the beat too.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              { icon: Sparkles, t: 'Lands every cut on the beat', d: 'Pick the cadence — every beat, every two, every four — and re-cut in one click.' },
              { icon: Captions, t: 'Captions and motion, already on', d: 'Synced lyric captions and a slow Ken-Burns push come baked into the import.' },
              { icon: Download, t: 'Every platform size at once', d: 'One timeline exports Reels, feed, YouTube and portrait — no re-framing by hand.' },
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
            <p className="mt-1 text-xs text-muted-foreground">covers and clips landing on every beat — reads as intentional.</p>
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
    { icon: Music, t: 'Wired to your studio', d: 'One-click handoffs from Pam and Video Studio bring your covers, clips and songs straight in.' },
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
              The cutting room of the Irie ecosystem — where your song and visuals become a video
              that cuts to the beat.
            </p>
          </div>

          <div>
            <p className="font-display text-sm uppercase tracking-[0.2em] text-primary">The pipeline</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Music className="size-4 text-primary" /> Made in Pam</li>
              <li className="flex items-center gap-2"><Film className="size-4 text-primary" /> Made in Video Studio</li>
              <li className="flex items-center gap-2"><Scissors className="size-4 text-primary" /> Cut &amp; finished here</li>
            </ul>
          </div>

          <div>
            <p className="font-display text-sm uppercase tracking-[0.2em] text-primary">Open source</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href="https://github.com/corey470/irie-cut" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
                  <Code className="size-4" /> Source on GitHub
                </a>
              </li>
              <li>
                <a href="https://github.com/corey470/irie-cut/issues" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
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
            Built in the browser with <Heart className="size-3.5 text-primary" /> for the Irie ecosystem.
          </span>
          <span>Your media stays on your machine.</span>
        </div>
      </div>
    </footer>
  )
}
