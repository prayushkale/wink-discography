import { useEffect, useMemo } from 'react'
import discography from './data/discography.json'
import samples from './data/samples.json'
import { useDeck } from './hooks/useDeck.js'
import IntroSlide from './components/slides/IntroSlide.jsx'
import YearDividerSlide from './components/slides/YearDividerSlide.jsx'
import SingleSlide from './components/slides/SingleSlide.jsx'
import AlbumSlide from './components/slides/AlbumSlide.jsx'
import FinaleSlide from './components/slides/FinaleSlide.jsx'

const albumCoverSlug = (album, i) =>
  `${String(i + 1).padStart(2, '0')}-${album.titleEn
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .slice(0, 48)}.jpg`

/** build the ordered slide list: intro -> per-year (divider + releases) -> finale */
function buildSlides(data) {
  const slides = [{ type: 'intro', label: 'Intro' }]

  const items = [
    ...data.singles.map((s) => ({ kind: 'single', date: s.releaseDate, single: s })),
    ...data.albums.map((a, i) => ({
      kind: 'album',
      date: a.released,
      album: a,
      coverSlug: albumCoverSlug(a, i),
      coverIdx: i,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  let lastYear = null
  const epilogue = []
  for (const item of items) {
    const year = Number(item.date.slice(0, 4))
    if (year !== lastYear) {
      if (lastYear !== null && year > 1996) {
        // 2018 reissue: fold into finale epilogue instead of its own year
        epilogue.push(item)
        continue
      }
      slides.push({ type: 'year', year, label: String(year) })
      lastYear = year
    }
    if (item.kind === 'single') {
      const key = `single-${String(item.single.num).padStart(2, '0')}`
      slides.push({ type: 'single', item, sample: samples[key] ?? null, label: item.single.titleEn })
    } else {
      const tracks = item.album.tracks.map((t) => ({
        ...t,
        sample:
          t.video && t.no != null
            ? samples[`album-${String(item.coverIdx + 1).padStart(2, '0')}-track-${String(t.no).padStart(2, '0')}`] ?? null
            : null,
      }))
      const firstSample = tracks.find((t) => t.sample)?.sample ?? null
      slides.push({ type: 'album', item, tracks, sample: firstSample, label: item.album.titleEn })
    }
  }

  slides.push({ type: 'finale', epilogue: epilogue.map((e) => e.single), label: 'Finale' })
  return slides
}

export default function App() {
  const slides = useMemo(() => buildSlides(discography), [])
  const deck = useDeck(slides)
  const renderClass = deck.isRenderMode ? 'render-mode' : ''

  // expose metadata for the video renderer
  useEffect(() => {
    if (!deck.isRenderMode) return
    window.__deckSlides = slides.map((s) => ({
      type: s.type,
      label: s.label ?? '',
      year: s.year ?? null,
      sampleSrc: s.sample?.src ?? null,
    }))
  }, [deck.isRenderMode, slides])

  return (
    <div className={`slide-bg scanlines relative h-full w-full overflow-hidden ${renderClass}`}>
      {slides.map((slide, i) => (
        <section
          key={i}
          className={`absolute inset-0 transition-opacity duration-500 ${
            i === deck.index ? 'opacity-100 z-10 slide-enter' : 'opacity-0 z-0 pointer-events-none'
          }`}
          aria-hidden={i !== deck.index}
        >
          {i === deck.index &&
            (slide.type === 'intro' ? (
              <IntroSlide data={discography} />
            ) : slide.type === 'year' ? (
              <YearDividerSlide year={slide.year} />
            ) : slide.type === 'single' ? (
              <SingleSlide single={slide.item.single} sample={slide.sample} />
            ) : slide.type === 'album' ? (
              <AlbumSlide entry={slide.item} tracks={slide.tracks} />
            ) : (
              <FinaleSlide data={discography} epilogue={slide.epilogue} />
            ))}
        </section>
      ))}

      {/* chrome */}
      {!deck.isRenderMode && (
        <>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-20">
            <div
              className="h-full bg-gradient-to-r from-pink-400 to-teal-300 transition-all duration-500"
              style={{ width: `${((deck.index + 1) / deck.total) * 100}%` }}
            />
          </div>
          <div className="absolute bottom-4 right-6 text-xs text-slate-400 z-20 font-display tracking-widest">
            {deck.index + 1} / {deck.total}
          </div>
          <div className="absolute bottom-4 left-6 text-xs text-slate-500 z-20">
            ← → navigate · click right half = next
          </div>
          <button
            onClick={deck.prev}
            aria-label="previous"
            className="absolute left-0 top-0 h-[85%] w-[30%] z-15 cursor-w-resize"
          />
          <button
            onClick={deck.next}
            aria-label="next"
            className="absolute right-0 top-0 h-[85%] w-[70%] z-15 cursor-e-resize"
          />
        </>
      )}
    </div>
  )
}
