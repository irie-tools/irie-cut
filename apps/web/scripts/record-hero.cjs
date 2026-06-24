// Record a short clip of the Irie Cut editor running a beat-cut, for the landing hero.
//
// Produces /tmp/hero-rec/*.webm — then post-process with ffmpeg into
// public/hero.mp4 + public/hero.webm + public/hero-poster.jpg (the <EditorReel>
// in src/routes/index.tsx reads those). To re-record:
//   1) put demo media in apps/web/public/ : vclipA.mp4, vclipB.mp4, song.m4a
//      (or edit the seed below to use your own project's media)
//   2) start the dev server: bun run dev   (serves http://localhost:5173)
//   3) NODE_PATH="$(pwd)/node_modules" node scripts/record-hero.cjs   (from apps/web)
//   4) ffmpeg -ss 3 -i /tmp/hero-rec/*.webm -t 4 -an -vf scale=1280:800,format=yuv420p \
//        -c:v libx264 -crf 24 -movflags +faststart public/hero.mp4   (+ webm + poster)
//   5) remove the demo media from public/ again.
// Needs playwright-core (devDependency) + an installed Chromium (path below).
const { chromium } = require('playwright-core')
const path = require('node:path')

const EXE =
  '/Users/irieagent/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const W = 1280
const H = 800
const OUT = '/tmp/hero-rec'

;(async () => {
  const browser = await chromium.launch({
    executablePath: EXE,
    headless: false,
    args: ['--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'],
  })
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
    recordVideo: { dir: OUT, size: { width: W, height: H } },
  })
  const page = await context.newPage()

  // land on the app origin so IndexedDB is writable, then seed a beat-cut project.
  await page.goto('http://localhost:5173/projects', { waitUntil: 'domcontentloaded' })

  const projectId = await page.evaluate(async () => {
    const uid = () => crypto.randomUUID()
    const fetchBlob = (u) => fetch(u).then((r) => r.blob())
    const [a, b, s] = await Promise.all([
      fetchBlob('/vclipA.mp4'),
      fetchBlob('/vclipB.mp4'),
      fetchBlob('/song.m4a'),
    ])
    const pid = uid()
    const mA = uid(),
      mB = uid(),
      mS = uid()
    const vTrack = uid(),
      aTrack = uid()
    const now = Date.now()
    // beat-cut layout: cover/clip segments landing on the beat
    const segs = [
      [0, 0.488, mA],
      [0.488, 0.998, mB],
      [1.486, 0.998, mA],
      [2.485, 1.01, mB],
      [3.495, 0.998, mA],
      [4.493, 0.998, mB],
      [5.492, 0.508, mA],
    ]
    const clips = segs.map(([start, dur, mid], i) => ({
      id: uid(),
      trackId: vTrack,
      type: 'video',
      name: 'Clip',
      mediaId: mid,
      start,
      duration: dur,
      trimStart: 0,
      trimEnd: dur,
      volume: 1,
      fit: 'cover',
    }))
    const mk = (id, name, type, dur, w, h, mime) => ({
      id,
      projectId: pid,
      name,
      type,
      mimeType: mime,
      size: 0,
      duration: dur,
      width: w,
      height: h,
      createdAt: now,
    })
    const project = {
      id: pid,
      name: 'Hero — Drift Me Home',
      createdAt: now,
      updatedAt: now,
      width: 1080,
      height: 1920,
      fps: 30,
      background: '#000000',
      masterVolume: 1,
      markers: [],
      tracks: [
        { id: vTrack, type: 'video', name: 'Visuals', muted: false, solo: false, volume: 1, clips },
        {
          id: aTrack,
          type: 'audio',
          name: 'Song',
          muted: false,
          solo: false,
          volume: 1,
          clips: [
            { id: uid(), trackId: aTrack, type: 'audio', name: 'Song', mediaId: mS, start: 0, duration: 6, trimStart: 0, trimEnd: 6, volume: 1 },
          ],
        },
      ],
    }
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('irie-cut', 1)
      r.onupgradeneeded = () => {
        const d = r.result
        if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' })
        if (!d.objectStoreNames.contains('media')) {
          const m = d.createObjectStore('media', { keyPath: 'id' })
          m.createIndex('projectId', 'projectId', { unique: false })
        }
        if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs', { keyPath: 'id' })
      }
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    const put = (store, val) =>
      new Promise((res, rej) => {
        const t = db.transaction(store, 'readwrite')
        t.objectStore(store).put(val)
        t.oncomplete = () => res()
        t.onerror = () => rej(t.error)
      })
    await put('blobs', { id: mA, blob: a })
    await put('blobs', { id: mB, blob: b })
    await put('blobs', { id: mS, blob: s })
    await put('media', mk(mA, 'Clip A', 'video', 3, 360, 640, a.type || 'video/mp4'))
    await put('media', mk(mB, 'Clip B', 'video', 3, 360, 640, b.type || 'video/mp4'))
    await put('media', mk(mS, 'Song', 'audio', 6, 0, 0, s.type || 'audio/mp4'))
    await put('projects', project)
    return pid
  })

  await page.goto(`http://localhost:5173/editor/${projectId}`, { waitUntil: 'networkidle' })
  await page.addStyleTag({ content: '*{cursor:none !important}' })
  await page.waitForTimeout(1500)

  // Start playback (Play button has aria-label "Play").
  const play = page.locator('button[aria-label="Play"]')
  if (await play.count()) await play.first().click()
  else await page.keyboard.press('Space')

  await page.waitForTimeout(7000)

  await context.close() // flushes the video file
  await browser.close()
  console.log('done — video in', OUT)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
