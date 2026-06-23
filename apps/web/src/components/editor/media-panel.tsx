import { useRef, useState } from 'react'
import {
  Upload,
  Video,
  Music,
  Image as ImageIcon,
  Trash2,
  Plus,
  Type,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { ScrollArea } from '#/components/ui/scroll-area'
import { useEditorStore } from '#/stores/editor-store'
import type { MediaAsset } from '#/types/editor'
import { formatDuration } from '#/lib/media'
import { cn } from '#/lib/utils'
import { TEMPLATES } from '#/lib/templates'

export function MediaPanel() {
  return (
    <div className="flex h-full flex-col border-r border-border bg-card/30">
      <Tabs defaultValue="media" className="flex h-full flex-col gap-0">
        <TabsList className="m-2 grid grid-cols-3">
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="text">Text</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>
        <TabsContent value="media" className="min-h-0 flex-1">
          <MediaTab />
        </TabsContent>
        <TabsContent value="text" className="min-h-0 flex-1">
          <TextTab />
        </TabsContent>
        <TabsContent value="templates" className="min-h-0 flex-1">
          <TemplatesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function MediaTab() {
  const media = useEditorStore((s) => s.media)
  const importFiles = useEditorStore((s) => s.importFiles)
  const importing = useEditorStore((s) => s.importing)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) void importFiles(e.dataTransfer.files)
  }

  return (
    <div className="flex h-full flex-col px-2 pb-2">
      <input
        ref={inputRef}
        type="file"
        accept="video/*,audio/*,image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void importFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'mb-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border py-6 text-center transition-colors hover:border-primary/50 hover:bg-accent/40',
          dragOver && 'border-primary bg-accent/60',
        )}
      >
        <Upload className="mb-2 size-5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          {importing ? 'Importing…' : 'Drop files or click to import'}
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {media.length === 0 ? (
          <p className="px-1 py-8 text-center text-xs text-muted-foreground">
            No media yet. Import video, audio or images.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 pr-2">
            {media.map((m) => (
              <MediaCard key={m.id} asset={m} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

function MediaCard({ asset }: { asset: MediaAsset }) {
  const addClipFromMedia = useEditorStore((s) => s.addClipFromMedia)
  const removeMedia = useEditorStore((s) => s.removeMedia)
  const Icon = asset.type === 'video' ? Video : asset.type === 'audio' ? Music : ImageIcon

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-background"
      draggable
      onDragStart={(e) => e.dataTransfer.setData('application/x-irie-cut-media', asset.id)}
    >
      <div className="flex aspect-video items-center justify-center bg-black/40">
        {asset.thumbnail ? (
          <img src={asset.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon className="size-6 text-muted-foreground" />
        )}
        <button
          onClick={() => void removeMedia(asset.id)}
          className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white/80 opacity-0 transition hover:text-white group-hover:opacity-100"
          aria-label="Remove media"
        >
          <Trash2 className="size-3.5" />
        </button>
        <button
          onClick={() => addClipFromMedia(asset.id)}
          className="absolute inset-0 flex items-center justify-center bg-primary/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100"
          aria-label="Add to timeline"
        >
          <span className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
            <Plus className="size-3" /> Add
          </span>
        </button>
      </div>
      <div className="flex items-center gap-1 px-2 py-1.5">
        <Icon className="size-3 shrink-0 text-muted-foreground" />
        <span className="truncate text-[11px]" title={asset.name}>
          {asset.name}
        </span>
        {asset.type !== 'image' && (
          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
            {formatDuration(asset.duration)}
          </span>
        )}
      </div>
    </div>
  )
}

function TextTab() {
  const addTextClip = useEditorStore((s) => s.addTextClip)
  return (
    <div className="px-3 pb-2">
      <button
        onClick={addTextClip}
        className="flex w-full items-center gap-3 rounded-lg border border-border bg-background p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
      >
        <div className="flex size-10 items-center justify-center rounded-md bg-accent">
          <Type className="size-5" />
        </div>
        <div>
          <p className="text-sm font-medium">Add text</p>
          <p className="text-xs text-muted-foreground">Place a title at the playhead</p>
        </div>
      </button>
    </div>
  )
}

function TemplatesTab() {
  const applyTemplate = useEditorStore((s) => s.applyTemplate)
  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 px-3 pb-2">
        <p className="px-1 pt-1 text-xs text-muted-foreground">
          Set the canvas format and drop in a starter layout.
        </p>
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => applyTemplate(t)}
            className="flex w-full items-center gap-3 rounded-lg border border-border bg-background p-2.5 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <AspectThumb ratio={t.ratio} />
            <div className="min-w-0">
              <p className="text-sm font-medium">{t.label}</p>
              <p className="truncate text-xs text-muted-foreground">
                {t.ratio} · {t.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  )
}

/** A little aspect-ratio swatch for the template card. */
function AspectThumb({ ratio }: { ratio: string }) {
  const [w, h] = ratio.split(':').map(Number)
  const portrait = h > w
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent">
      <div
        className="rounded-sm border border-primary/60 bg-primary/20"
        style={portrait ? { width: 18, height: 32 } : { width: 32, height: (32 * h) / w }}
      />
    </div>
  )
}
