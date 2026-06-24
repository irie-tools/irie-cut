import { useState } from 'react'
import { Sparkles, Loader2, Image as ImageIcon, Captions as CaptionsIcon, Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import { ScrollArea } from '#/components/ui/scroll-area'
import { useEditorStore } from '#/stores/editor-store'
import { generateCopy, generateImage, transcribe } from '#/lib/ai'
import { getMediaBlob } from '#/lib/storage'
import { cn } from '#/lib/utils'

const COPY_KINDS = [
  { id: 'hook', label: 'Hooks' },
  { id: 'cta', label: 'CTAs' },
  { id: 'caption', label: 'Captions' },
  { id: 'script', label: 'Script' },
]

export function AITab() {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 px-3 pb-3 pt-1">
        <p className="rounded-md bg-accent/40 px-2 py-1.5 text-[11px] text-muted-foreground">
          AI runs on the deployed site once an <code>AI_GATEWAY_API_KEY</code> is set in Vercel.
        </p>
        <CopyAssist />
        <ImageGen />
        <AutoCaptions />
      </div>
    </ScrollArea>
  )
}

function Section({ icon: Icon, title, children }: { icon: typeof Sparkles; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <Icon className="size-4 text-primary" /> {title}
      </div>
      {children}
    </div>
  )
}

function CopyAssist() {
  const addTextClip = useEditorStore((s) => s.addTextClip)
  const [kind, setKind] = useState('hook')
  const [prompt, setPrompt] = useState('')
  const [variants, setVariants] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    setLoading(true)
    setError('')
    try {
      const { variants } = await generateCopy(prompt || 'a short-form video about my product', kind)
      setVariants(variants)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section icon={Sparkles} title="Marketing copy">
      <div className="flex flex-wrap gap-1">
        {COPY_KINDS.map((k) => (
          <button
            key={k.id}
            onClick={() => setKind(k.id)}
            className={cn(
              'rounded-md border px-2 py-1 text-[11px] transition-colors',
              kind === k.id ? 'border-primary text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {k.label}
          </button>
        ))}
      </div>
      <Textarea
        rows={2}
        value={prompt}
        placeholder="What's the video about?"
        onChange={(e) => setPrompt(e.target.value)}
      />
      <Button size="sm" className="w-full" onClick={run} disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        Generate
      </Button>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      {variants.length > 0 && (
        <div className="space-y-1">
          {variants.map((v, i) => (
            <button
              key={i}
              onClick={() => addTextClip(v)}
              className="flex w-full items-start gap-1.5 rounded-md border border-border p-2 text-left text-[11px] transition-colors hover:border-primary/50 hover:bg-accent/40"
              title="Add as text clip"
            >
              <Plus className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
              <span>{v}</span>
            </button>
          ))}
        </div>
      )}
    </Section>
  )
}

function ImageGen() {
  const importFiles = useEditorStore((s) => s.importFiles)
  const addClipFromMedia = useEditorStore((s) => s.addClipFromMedia)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    setLoading(true)
    setError('')
    try {
      const { dataUrl } = await generateImage(prompt)
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], `ai-image-${Date.now()}.png`, { type: blob.type || 'image/png' })
      const [id] = await importFiles([file])
      if (id) addClipFromMedia(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section icon={ImageIcon} title="Generate image">
      <Textarea
        rows={2}
        value={prompt}
        placeholder="Describe a background or overlay…"
        onChange={(e) => setPrompt(e.target.value)}
      />
      <Button size="sm" className="w-full" onClick={run} disabled={loading || !prompt}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
        Generate & add
      </Button>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </Section>
  )
}

function AutoCaptions() {
  const selectedClipId = useEditorStore((s) => s.selectedClipId)
  const project = useEditorStore((s) => s.project)
  const addCaptions = useEditorStore((s) => s.addCaptions)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const clip = project?.tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId)
  const eligible = clip && (clip.type === 'video' || clip.type === 'audio') && clip.mediaId

  async function run() {
    if (!clip?.mediaId) return
    setLoading(true)
    setError('')
    setDone('')
    try {
      const blob = await getMediaBlob(clip.mediaId)
      if (!blob) throw new Error('Audio not found.')
      const { cues } = await transcribe(blob)
      addCaptions(cues, clip.start)
      setDone(`Added ${cues.length} caption(s).`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section icon={CaptionsIcon} title="Auto-captions">
      <p className="text-[11px] text-muted-foreground">
        {eligible ? 'Transcribe the selected clip into timed captions.' : 'Select a video or audio clip first.'}
      </p>
      <Button size="sm" className="w-full" onClick={run} disabled={loading || !eligible}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <CaptionsIcon className="size-4" />}
        Transcribe clip
      </Button>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      {done && <p className="text-[11px] text-emerald-500">{done}</p>}
    </Section>
  )
}
