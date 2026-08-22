import { useEffect, useMemo } from 'react'
import discography from './data/discography.json'
import { useDeck } from './hooks/useDeck.js'
import { PlayerProvider, usePlayer } from './player/PlayerProvider.jsx'
import { getOverrides } from './lib/overrides.js'
import { extractVideoId } from './player/yt.js'
import IntroSlide from './components/slides/IntroSlide.jsx'
import YearDividerSlide from './components/slides/YearDividerSlide.jsx'
import SingleSlide from './components/slides/SingleSlide.jsx'
import AlbumSlide from './components/slides/AlbumSlide.jsx'
import FinaleSlide from './components/slides/FinaleSlide.jsx'

const pad2 = (n) => String(n).padStart(2, '0')

const albumCoverSlug = (album, i) =>
  `${pad2(i + 1)}-${album.titleEn
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .slice(0, 48)}.jpg`

/** build the ordered slide list: intro -> per-year (divider + releases) -> finale */
function buildSlides(data) {
  const overrides = getOverrides()
  const resolve = (urlOrKey, fallbackUrl) => {
    const url = overrides[urlOrKey] ?? fallbackUrl ?? null
    return url ? extractVideoId(url) : null
  }

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
      const s = item.single
      const key = `single-${pad2(s.num)}`
      const tracks = s.tracks.map((t, ti) => ({
        ...t,
        key: `${key}-${t.role || ti}`,
        videoId: resolve(key, t.video),
      }))
      slides.push({
        type: 'single',
        item,
        tracks,
        label: s.titleEn,
        sampleSrc: tracks[0]?.videoId ? 'youtube' : null,
      })
    } else {
      const prefix = `a${pad2(item.coverIdx + 1)}`
      const tracks = item.album.tracks.map((t) => ({
        ...t,
        key: `${prefix}-track-${pad2(t.no)}`,
        videoId: resolve(`${prefix}-track-${pad2(t.no)}`, t.video),
      }))
      slides.push({
        type: 'album',
        item,
        tracks,
        albumPrefix: prefix,
        label: item.album.titleEn,
        sampleSrc: tracks.some((t) => t.videoId) ? 'youtube' : null,
      })
    }
  }

  slides.push({ type: 'finale', epilogue: epilogue.map((e) => e.single), label: 'Finale' })
  return slides
}

/** Bottom media-player-style control bar for the deck + now playing. */
function ControlBar({ deck }) {
  const player = usePlayer()
  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-[#0a0e2aee] backdrop-blur-md">
      {/* progress */}
      <div className="h-1.5 bg-white/10 cursor-pointer group">
        <div
          className="relative h-full bg-gradient-to-r from-pink-400 to-teal-300 transition-all duration-300"
          style={{ width: `${((deck.index + 1) / deck.total) * 100}%` }}
        />
      </div>
      <div className="flex items-center gap-5 px-6 py-3">
        {/* transport controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={deck.first}
            aria-label="first slide"
            className="h-10 w-10 rounded-full text-slate-300 hover:text-pink-300 hover:bg-white/10 text-lg"
          >
            ⏮
          </button>
          <button
            onClick={deck.prev}
            aria-label="previous slide"
            className="h-10 w-10 rounded-full text-slate-200 hover:text-pink-300 hover:bg-white/10 text-lg"
          >
            ◀
          </button>
          <button
            onClick={deck.next}
            aria-label="next slide"
            className="h-12 w-12 rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white text-xl shadow-[0_0_16px_rgba(255,110,199,0.5)] hover:scale-105 transition-transform flex items-center justify-center"
          >
            ▶
          </button>
          <button
            onClick={deck.last}
            aria-label="last slide"
            className="h-10 w-10 rounded-full text-slate-300 hover:text-pink-300 hover:bg-white/10 text-lg"
          >
            ⏭
          </button>
        </div>

        {/* now playing / hint */}
        <div className="flex-1 min-w-0">
          {player.current ? (
            <p className="truncate font-display text-sm text-pink-200">
              ♪ NOW PLAYING · {player.current.title}
              {!player.playing && <span className="text-slate-500"> (paused)</span>}
              <button onClick={player.stop} className="ml-3 text-slate-400 hover:text-pink-300">
                ■ stop
              </button>
            </p>
          ) : (
            <p className="text-sm text-slate-500">← → navigate · space next · press ▶ on a song to hear it</p>
          )}
        </div>

        <p className="font-display tracking-widest text-sm text-teal-200/80 shrink-0">
          {deck.index + 1} / {deck.total}
        </p>
      </div>
    </div>
  )
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
      sampleSrc: s.sampleSrc ?? null,
    }))
  }, [deck.isRenderMode, slides])

  return (
    <PlayerProvider>
      <div className={`slide-bg scanlines relative h-full w-full overflow-hidden ${renderClass}`}>
        {slides.map((slide, i) => (
          <section
            key={i}
            className={`absolute inset-0 pb-20 transition-opacity duration-500 ${
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
                <SingleSlide single={slide.item.single} sample={slide.sample} tracks={slide.tracks} />
              ) : slide.type === 'album' ? (
                <AlbumSlide entry={slide.item} tracks={slide.tracks} />
              ) : (
                <FinaleSlide data={discography} epilogue={slide.epilogue} />
              ))}
          </section>
        ))}

        {!deck.isRenderMode && <ControlBar deck={deck} />}
      </div>
    </PlayerProvider>
  )
}
