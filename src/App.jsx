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

/**
 * Estimated chorus starts (seconds) for the single-slide showcase player.
 * Deliberately NOT audio analysis: a structural guess for late-80s/90s J-pop
 * (intro ~8–15s, verse, first chorus lands ~0:38–0:52 of the PV). Each value
 * is the seconds offset used as the YouTube start point; fine-tune freely.
 * Singles missing an entry fall back to DEFAULT_CHORUS_START so every video
 * still starts at a plausible chorus point.
 */
const DEFAULT_CHORUS_START = 38
const CHORUS_STARTS = {
  // sugar baby love (official MV ~2:41)
  'single-01': 42,
  'single-02': 38, // Amaryllis
  'single-03': 40, // Ai ga Tomaranai
  'single-04': 38, // Namida wo Misenai de
  'single-05': 40, // Samishii Nettaigyo
  'single-06': 36, // One Night in Heaven
  'single-07': 40, // Sexy Music
  'single-08': 39, // Yoru ni Hagurete
  'single-09': 40, // New Moon ni Aimashou
  'single-10': 42, // Kitto Atsui Kuchibiru
  'single-11': 35, // Manatsu no Tremolo
  'single-12': 40, // Haitoku no Scenario
  'single-13': 38, // Tsuioku no Heroine
  'single-14': 40, // Matenrō Museum
  'single-15': 39, // Furimukanaide
  'single-16': 38, // Real na Yume no Jōken
  'single-17': 36, // Eien no Ladydoll
  'single-18': 40, // Kekkon Shiyoune
  'single-19': 38, // Sakihokore Itoshisa yo
  'single-20': 40, // Itsumademo Suki de Itakute
  'single-21': 33, // Twinkle Twinkle
  'single-22': 38, // Cherie Mon Cherie
  'single-23': 38, // Jive Into the Night
  'single-24': 42, // Jive Into the Night (Hyper Euro Mix)
  'single-25': 40, // Angel Love Story
  'single-26': 40, // Special to Me
}
/**
 * Same deal for the ORIGINAL-artist clips ("hear the original"): a structural
 * guess, not audio analysis. Keyed by track key; falls back to the single's
 * CHORUS_STARTS entry when the clip has no guess of its own.
 */
const ORIGINAL_STARTS = {
  'single-01-A': 30, // The Rubettes' 1974 original (~2:49; chorus arrives earlier than the PV)
  'single-03-A': 30, // Kyoko Koizumi original
  'single-03-B': 32,
  'single-04-A': 32, // Boys Don't Cry original
  'single-04-B': 34,
  'single-05-B': 32, // 500 Miles (The Brothers Four)
  'single-07-A': 32, // The Nolans original
  'single-08-A': 32, // Where Were You Last Night (Ankie Bagger)
  'single-08-B': 34,
  'single-12-B': 34,
  'single-15-A': 32,
  'single-15-B': 34,
  'single-16-B': 34,
}
/**
 * Estimated chorus starts (seconds) for the Moonlight Serenade album slide.
 * Structural guesses for late-80s J-pop, not audio analysis — every play
 * click starts exactly at the estimate so it lands inside/near the first
 * chorus.
 */
const ALBUM_CHORUS_STARTS = {
  a01: {
    1: 38, // 渚のモノガタリ
    2: 40, // NAVY BLUE
    3: 35, // BYE BYE BABY
    5: 42, // DANCE WITH ME
    6: 40, // すてきなHappy Birthday
    9: 30, // SUGAR BABY LOVE (cover, chorus arrives earlier)
    10: 44, // ジャスミンは悲しい香り
  },
  a02: {
    1: 38, // Ai ga Tomaranai
    2: 40, // LOVE IN THE FIRST DEGREE
    3: 38, // CROSS MY BROKEN HEART
    4: 42, // Ai ga Tomaranai (Remix)
    5: 30, // SUGAR BABY LOVE (Remix)
    6: 40, // Fuyu no Photograph
  },
  a03: {
    1: 36, // Especially For You
    2: 40, // Baby Me
    3: 38, // Heart Of Glass
    4: 38, // Only Lonely
    5: 42, // Take Me To Heaven
    7: 40, // Remember Sweet
    9: 40, // Yasashiku Aishite...
    10: 36, // Namida wo Misenai de
  },
  a04: {
    1: 30, // Oh My Love (Introduction)
    2: 38, // One Night In Heaven (Remix)
    3: 36, // Special To Me
    4: 40, // Shining Star
    6: 40, // Aishiteru
    7: 38, // In Your Letter
    8: 34, // Yakan Hikō
    9: 44, // Joanna
    10: 40, // Samishii Nettaigyo (Remix)
    11: 38, // Oh My Love
  },
  a05: {
    1: 38, // Sexy Music (Remix)
    2: 40, // Rainy Lonely Pavement
    3: 38, // Natsufuku no Juliet
    4: 36, // Unshakable
    6: 38, // Ginsei Club
    8: 34, // I'm Gonna Knock On Your Door
  },
  a06: {
    1: 38, // New Moon ni Aimashou (Remix)
    2: 40, // Kanashii Kareha
    4: 36, // Warui Yume
    6: 38, // Ame ni Kieta Hatsukoi
    7: 38, // Miracle Knight
    8: 38, // All Night Long
    9: 40, // Yoru ni Hagurete (Remix)
    10: 42, // Variation
  },
  a07: {
    1: 35, // Manatsu no Tremolo
    2: 38, // Omoide ni Good Luck
    3: 38, // Mysterious
    5: 34, // Fun, Fun, Fun
    6: 40, // Awa ni Naru
    8: 40, // Kitto Atsui Kuchibiru
    10: 38, // Mighty Mighty Love
    11: 36, // Shake It
    12: 40, // Kiseki no Monument
  },
  a08: {
    1: 36, // Ano Yoru e Kaeritai
    2: 38, // Big Game
    3: 38, // Yamiyo no Tōbōsha
    5: 36, // Seikimatsu mo Heiki
    7: 38, // Get My Love
    9: 42, // Tears
    10: 40, // Haitoku no Scenario
  },
  a09: {
    1: 38, // Frou-Frou
    2: 38, // Pierce no Shinsō
    3: 38, // Matenrō Museum
    5: 38, // Like a Bird
    7: 36, // Kiri no Rakuen
    9: 40, // Tsuioku no Heroine
    11: 38, // Scarlet no Yakusoku
    12: 38, // Image na Kankei
  },
  a10: {
    1: 38, // Real na Yume no Jōken
    2: 40, // Anata ni Himitsu na Yoru
    4: 38, // Celebration
    5: 38, // Setsuna Version
    6: 38, // Only One
    7: 38, // Mujitsu no Object
    9: 39, // Furimukanaide
  },
  a11: {
    1: 40, // Kekkon Shiyoune
    3: 36, // Fishselfish
    4: 38, // Save My Life
    7: 38, // Eien no Ladydoll
    9: 38, // I Wanna Leave You
    11: 38, // Alone Again
  },
  a12: {
    1: 38, // Movin' On
    2: 36, // Made In Love
    7: 40, // Sakihokore Itoshisa yo
  },
  a13: {
    1: 36, // Que Sera C'est la vie
    3: 38, // You're My Rainy Day
    4: 38, // Twinkle Twinkle (60's Version)
    5: 38, // Itsumademo Suki de Itakute
    8: 36, // Tasty (Acoustic Version)
    9: 38, // Days
    10: 38, // Twinkle Twinkle (Original Version)
  },
  a14: {
    1: 38, // Sore wa Kiss de Hajimatta
    2: 38, // Honey Bee
    3: 38, // Cherie Mon Cherie
    6: 38, // Please Please Me
    7: 36, // Sunny Day
  },
  a15: {
    3: 42, // Jive Into the Night (House Mix)
    4: 38, // Ain't Nobody
    5: 38, // My Turn
    10: 38, // Watashitachi Rashii Rule
    11: 42, // Jive Into the Night (Hyper Euro Mix)
  },
}
const buildChorusConfig = (single, tracks) => {
  const est = CHORUS_STARTS[`single-${pad2(single.num)}`] ?? DEFAULT_CHORUS_START
  const cfg = {}
  for (const t of tracks) {
    if (t.videoId) cfg[t.key] = { key: t.key, videoId: t.videoId, startSeconds: est, title: t.titleEn }
    if (t.originalVideoId) {
      cfg[`original:${t.key}`] = {
        key: `original:${t.key}`,
        videoId: t.originalVideoId,
        startSeconds: ORIGINAL_STARTS[t.key] ?? est,
        title: `${t.original?.split('—')[0]?.trim() || t.titleEn} (original)`,
      }
    }
  }
  // no playable tracks on this single → fall back to the standard slide layout
  if (Object.keys(cfg).length === 0) return null
  return { tracks: cfg }
}

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
      const tracks = s.tracks.map((t, ti) => {
        const trackKey = `${key}-${t.role || ti}`
        // single-level override (e.g. "single-23") applies ONLY to the A-side;
        // B-sides resolve their own track key then the raw video field. This
        // stops a single's override from leaking into the B-side card.
        const overrideUrl = overrides[trackKey] ?? (ti === 0 ? overrides[key] : undefined)
        const url = overrideUrl ?? t.video ?? null
        return {
          ...t,
          key: trackKey,
          videoId: url ? extractVideoId(url) : null,
          originalVideoId: t.originalVideo ? extractVideoId(t.originalVideo) : null,
          originalStartSeconds: t.originalVideo
            ? (ORIGINAL_STARTS[`${key}-${t.role || ti}`] ?? CHORUS_STARTS[key] ?? DEFAULT_CHORUS_START)
            : null,
        }
      })
      slides.push({
        type: 'single',
        item,
        tracks,
        label: s.titleEn,
        sampleSrc: tracks[0]?.videoId ? 'youtube' : null,
        // showcase mode: song cards kept intact, artwork beside the title on
        // the left, a max-size YouTube player on the right whose play buttons
        // start each song at an ESTIMATED chorus point (~0:33–0:48, where
        // J-pop first choruses normally land). No audio analysis — tunable by
        // editing CHORUS_STARTS / ORIGINAL_STARTS above. Singles without a
        // chorus estimate (or without playable video) fall back to the
        // standard slide with the mini bottom player.
        chorus: buildChorusConfig(s, tracks),
      })
    } else {
      const prefix = `a${pad2(item.coverIdx + 1)}`
      const tracks = item.album.tracks.map((t) => ({
        ...t,
        key: `${prefix}-track-${pad2(t.no)}`,
        videoId: resolve(`${prefix}-track-${pad2(t.no)}`, t.video),
        chorusStart: ALBUM_CHORUS_STARTS[prefix]?.[t.no] ?? DEFAULT_CHORUS_START,
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
  // stop any playing song when the deck moves to a different slide
  useEffect(() => {
    player.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.index])
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
                <SingleSlide
                  single={slide.item.single}
                  tracks={slide.tracks}
                  chorus={slide.chorus}
                />
              ) : slide.type === 'album' ? (
                <AlbumSlide entry={slide.item} tracks={slide.tracks} albumPrefix={slide.albumPrefix} />
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
