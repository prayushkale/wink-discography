import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Deck state: slide list, current index, keyboard/touch/click navigation.
 * In render mode (?render=1) navigation is exposed via window.__deckAdvance().
 */
export function useDeck(slides) {
  const [index, setIndex] = useState(0)
  const isRenderMode = useMemo(() => new URLSearchParams(location.search).get('render') === '1', [])

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, slides.length - 1)), [slides.length])
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [])

  useEffect(() => {
    const onKey = (e) => {
      if (['ArrowRight', ' ', 'PageDown', 'Enter'].includes(e.key)) {
        e.preventDefault()
        next()
      } else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault()
        prev()
      } else if (e.key === 'Home') setIndex(0)
      else if (e.key === 'End') setIndex(slides.length - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, slides.length])

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

  return { index, slide: slides[index], next, prev, total: slides.length, isRenderMode }
}
