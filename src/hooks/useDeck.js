import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Deck state: slide list, current index, keyboard/touch navigation.
 * In render mode (?render=1) navigation is exposed via window.__deckAdvance().
 */
export function useDeck(slides) {
  const [index, setIndex] = useState(0)
  const isRenderMode = useMemo(() => new URLSearchParams(location.search).get('render') === '1', [])

  const goto = useCallback((i) => setIndex(() => Math.max(0, Math.min(i, slides.length - 1))), [slides.length])
  const next = useCallback(() => setIndex((i) => Math.min(i + 1, slides.length - 1)), [slides.length])
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [])
  const first = useCallback(() => setIndex(0), [])
  const last = useCallback(() => setIndex(slides.length - 1), [slides.length])

  useEffect(() => {
    const onKey = (e) => {
      if (['ArrowRight', ' ', 'PageDown', 'Enter'].includes(e.key)) {
        e.preventDefault()
        next()
      } else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault()
        prev()
      } else if (e.key === 'Home') first()
      else if (e.key === 'End') last()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, first, last])

  useEffect(() => {
    window.__deckAdvance = (n = 1) => (n > 0 ? next() : prev())
  }, [next, prev])

  // touch swipe
  useEffect(() => {
    let startX = null
    const onStart = (e) => (startX = e.touches[0].clientX)
    const onEnd = (e) => {
      if (startX === null) return
      const dx = e.changedTouches[0].clientX - startX
      if (Math.abs(dx) > 60) (dx < 0 ? next : prev)()
      startX = null
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [next, prev])

  return { index, slide: slides[index], goto, next, prev, first, last, total: slides.length, isRenderMode }
}
