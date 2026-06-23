import { useEffect } from 'react'
import { useEditorStore, projectDuration } from '#/stores/editor-store'

/**
 * Drives the playhead clock. While `isPlaying`, advances `currentTime` by the
 * real elapsed time each animation frame and auto-stops at the end of the
 * timeline. Mount once at the editor root.
 */
export function usePlayback() {
  const isPlaying = useEditorStore((s) => s.isPlaying)

  useEffect(() => {
    if (!isPlaying) return
    let raf = 0
    let last = performance.now()

    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const { currentTime, project, setCurrentTime, setPlaying } = useEditorStore.getState()
      const total = projectDuration(project)
      const next = currentTime + dt
      if (next >= total) {
        setCurrentTime(total)
        setPlaying(false)
        return
      }
      setCurrentTime(next)
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isPlaying])
}
