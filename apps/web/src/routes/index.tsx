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
} from 'lucide-react'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="min-h-screen">
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
      <nav className="flex items-center gap-2">
        <a
          href="https://github.com/corey470/irie-cut"
          target="_blank"
          rel="noreferrer"
          className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
        >
          Source
        </a>
        <Button className="gold-glow" nativeButton={false} render={<Link to="/projects" />}>
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

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary/90">{children}</p>
  )
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-10 pb-20 lg:pt-16">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.06] px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Part of the Irie ecosystem · free · on-device
          </div>
          <h1 className="text-balance font-heading text-5xl font-semibold leading-[1.02] sm:text-6xl">
            Your song and your visuals, cut to the beat.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Irie Cut is the cutting room of your Irie studio. Bring cover art from{' '}
            <span className="text-foreground">Pam</span> or clips from{' '}
            <span className="text-foreground">Video Studio</span>, drop in the track, and it lays
            them to the beat — captioned and sized for every platform. All on your machine. No
            account, nothing uploaded.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="lg" className="gold-glow w-full sm:w-auto" nativeButton={false} render={<Link to="/projects" />}>
              Start cutting
            </Button>
            <a
              href="https://github.com/corey470/irie-cut"
              target="_blank"
              rel="noreferrer"
              className="text-center text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              View the source
            </a>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            100% on-device · no sign-up · MIT licensed
          </p>
        </div>

        <BeatCutPreview />
      </div>
    </section>
  )
}

/**
 * The hero visual IS the promise: a beat-cut on the timeline — visual segments
 * snapping to the song's beats over a waveform. If this were removed, the page
 * would lose its meaning, so it is not decoration.
 */
function BeatCutPreview() {
  // Segment widths (sum ~100) and the warm tints that stand in for cover/clip clips.
  const segs = [
    { w: 15, c: 'bg-primary/70' },
    { w: 13, c: 'bg-[#e8c96a]/60' },
    { w: 13, c: 'bg-primary/55' },
    { w: 17, c: 'bg-[#a68838]/70' },
    { w: 13, c: 'bg-[#e8c96a]/55' },
    { w: 29, c: 'bg-primary/65' },
  ]
  // Beat tick positions = cumulative segment boundaries.
  const ticks: number[] = []
  let acc = 0
  for (const s of segs.slice(0, -1)) {
    acc += s.w
    ticks.push(acc)
  }
  const bars = [3, 6, 4, 8, 5, 9, 6, 11, 7, 5, 9, 13, 8, 6, 10, 7, 12, 8, 5, 9, 7, 11, 6, 9, 5, 8, 12, 7, 6, 10, 8, 5, 9, 7, 11, 6, 8, 5, 7, 4]

  return (
    <div className="rounded-xl border border-primary/15 bg-card/70 p-2 shadow-2xl ring-1 ring-primary/5">
      {/* window chrome */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span className="size-2.5 rounded-full bg-red-500/60" />
        <span className="size-2.5 rounded-full bg-yellow-500/60" />
        <span className="size-2.5 rounded-full bg-green-500/60" />
        <span className="ml-2 text-[11px] text-muted-foreground">Irie Cut — Tour teaser</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        {/* preview canvas — the cover art in motion */}
        <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-[#2a2520] via-[#1a1714] to-black">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(201,168,76,0.18),transparent_60%)]" />
          <div className="relative text-center">
            <span className="block font-heading text-3xl font-semibold text-foreground sm:text-4xl">
              Drift Me Home
            </span>
            <span className="mt-1 block text-xs uppercase tracking-[0.25em] text-primary/80">
              new single · out now
            </span>
          </div>
        </div>

        {/* the beat-cut timeline */}
        <div className="relative bg-background/80 p-3">
          {/* beat ticks span both tracks */}
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute top-2 bottom-2 w-px bg-primary/40"
              style={{ left: `calc(0.75rem + ${t}% * (100% - 1.5rem) / 100)` }}
            />
          ))}
          {/* playhead */}
          <span className="absolute top-1 bottom-1 left-[42%] w-0.5 rounded bg-primary" />

          {/* visuals track — cover/clip segments, boundaries on the beats */}
          <div className="flex gap-0.5">
            {segs.map((s, i) => (
              <div key={i} className={`h-7 rounded-sm ${s.c}`} style={{ width: `${s.w}%` }} />
            ))}
          </div>
          {/* song track — waveform */}
          <div className="mt-1.5 flex h-7 items-center gap-[2px] rounded-sm bg-secondary/60 px-1.5">
            {bars.map((h, i) => (
              <span
                key={i}
                className="w-[2px] flex-1 rounded-full bg-foreground/35"
                style={{ height: `${(h / 13) * 100}%` }}
              />
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
    <section className="border-t border-border bg-card/20">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <Eyebrow>The release pipeline</Eyebrow>
        <h2 className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">
          From a finished song to a posted promo.
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Irie Cut is the back half of the release. The making happens upstream in your studio;
          the cutting and finishing happen here — and nothing ever leaves your machine.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PIPELINE.map((s, i) => (
            <div key={s.title} className="relative rounded-xl border border-border bg-card p-6">
              <span className="absolute right-5 top-5 font-heading text-3xl font-semibold text-primary/20">
                {i + 1}
              </span>
              <s.icon className="mb-4 size-7 text-primary" />
              <h3 className="font-heading text-xl font-semibold">{s.title}</h3>
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
          <h2 className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">
            Cover variations and clips, cut to the music.
          </h2>
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
            <Button className="gold-glow" nativeButton={false} render={<Link to="/projects" />}>
              Make a beat-cut
            </Button>
          </div>
        </div>

        {/* A simple before/after: one looping clip vs. a beat-cut sequence. */}
        <div className="space-y-4 rounded-xl border border-border bg-card/60 p-5">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">A loop, on repeat</p>
            <div className="flex gap-0.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-7 flex-1 rounded-sm bg-muted" />
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">one clip stretched over the whole song — reads as filler.</p>
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-primary/80">Cut to the beat</p>
            <div className="flex gap-0.5">
              {[15, 13, 13, 17, 13, 29].map((w, i) => (
                <div
                  key={i}
                  className={`h-7 rounded-sm ${['bg-primary/70', 'bg-[#e8c96a]/60', 'bg-primary/55', 'bg-[#a68838]/70', 'bg-[#e8c96a]/55', 'bg-primary/65'][i]}`}
                  style={{ width: `${w}%` }}
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
  {
    icon: Layers,
    title: 'Multi-track timeline',
    body: 'Stack video, images, audio and text on independent tracks. Drag to move, grab an edge to trim, split at the playhead.',
  },
  {
    icon: Type,
    title: 'Titles & captions',
    body: 'Drop styled text anywhere on the frame, or turn synced lyrics into burned-in captions sized for a muted feed.',
  },
  {
    icon: Scissors,
    title: 'Precise cutting',
    body: 'Scrub to the frame, split a clip in two, duplicate, ripple-delete. Keyboard shortcuts keep your hands on the edit.',
  },
  {
    icon: Download,
    title: 'Real in-browser export',
    body: 'Render the timeline — video, overlays and mixed audio — to a downloadable MP4 without ever leaving the page.',
  },
]

function RealEditor() {
  return (
    <section className="border-t border-border bg-card/20">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <Eyebrow>Not a toy</Eyebrow>
        <h2 className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">
          And it&apos;s a real editor underneath.
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          The beat-cut is the fast lane. When you want to get in by hand, the full editor is right
          there — frame-accurate, multi-track, and rendered entirely on your device.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
            >
              <f.icon className="mb-4 size-7 text-primary" />
              <h3 className="font-heading text-xl font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Trust() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 sm:grid-cols-3">
        <div>
          <ShieldCheck className="mb-3 size-7 text-primary" />
          <h3 className="font-heading text-xl font-semibold">Your media never leaves your device</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Files are stored locally and every frame is rendered on-device. There is no server to
            upload to — by design.
          </p>
        </div>
        <div>
          <Sparkles className="mb-3 size-7 text-primary" />
          <h3 className="font-heading text-xl font-semibold">No account, no watermark</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Open the editor and start. Exports come out clean — no badge stamped across your work,
            no sign-up wall in the way.
          </p>
        </div>
        <div>
          <Music className="mb-3 size-7 text-primary" />
          <h3 className="font-heading text-xl font-semibold">Wired to your studio</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            One-click handoffs from Pam and Video Studio bring your covers, clips and songs straight
            in — Irie Cut finishes what they start.
          </p>
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h2 className="text-balance font-heading text-4xl font-semibold sm:text-5xl">
        Make your first cut.
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
        Open the editor and start a project. No download, no account — just you, your song, and your
        footage.
      </p>
      <div className="mt-8">
        <Button size="lg" className="gold-glow" nativeButton={false} render={<Link to="/projects" />}>
          Start cutting
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
        <span>The cutting room of the Irie ecosystem · your media stays on your machine.</span>
      </div>
    </footer>
  )
}
