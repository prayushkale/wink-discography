import { useCallback, useEffect, useRef, useState } from 'react'
import { PlayButton, TrackDetails, riajChip } from '../TrackBits.jsx'
import { usePlayer } from '../../player/PlayerProvider.jsx'
import { setOverride } from '../../lib/overrides.js'
import { extractVideoId } from '../../player/yt.js'
import ChorusSamplePlayer from '../ChorusSamplePlayer.jsx'

const pad2 = (n) => String(n).padStart(2, '0')

export default function SingleSlide({ single, tracks, chorus }) {
  const aSide = tracks[0]
  const bSide = tracks[1]
  const player = usePlayer()

  // Non-showcase singles (no chorus config): while a track from this single
  // plays, host the shared YouTube player in place of the cover art (left
  // side) instead of the small bottom mini player.
  const videoSlotRef = useRef(null)
  const singlePrefix = `single-${pad2(single.num)}`
  const slidePlaying = !chorus && Boolean(player.current?.key?.startsWith(`${singlePrefix}-`))

  const { attachHost, detachHost } = player
  useEffect(() => {
    if (slidePlaying && videoSlotRef.current) attachHost(videoSlotRef.current)
    else detachHost()
  }, [slidePlaying, attachHost, detachHost])
  // navigating away from the slide: return the player to its home position
  useEffect(() => () => detachHost(), [detachHost])

  // slide-3 showcase mode: play buttons drive the big on-slide player
  // (starts at the estimated chorus) instead of the small bottom player.
  const showcaseRef = useRef(null)
  const [showcase, setShowcase] = useState({ key: null, playing: false })
  const onShowcaseState = useCallback((s) => setShowcase(s), [])
  const showcasePlay = useCallback(
    (key) => {
      // accepts a track key or an `original:<key>`-suffixed alias
      const cfg = chorus?.tracks?.[key] ?? chorus?.tracks?.[`original:${key}`]
      if (!cfg || !showcaseRef.current) return
      showcaseRef.current.playTrack(cfg)
    },
    [chorus],
  )
  // 'hear the original' handler: track objects map to their `original:<key>`
  // chorus entry so the ORIGINAL-artist clip plays in the side player.
  const showcasePlayOriginal = useCallback(
    (track) => {
      const key = typeof track === 'string' ? track : `original:${track?.key}`
      const cfg = chorus?.tracks?.[key]
      if (!cfg || !showcaseRef.current) return
      showcaseRef.current.playTrack(cfg)
    },
    [chorus],
  )
  const showcaseToggle = useCallback(
    (key) => {
      const cfg = chorus?.tracks?.[key]
      if (!cfg || !showcaseRef.current) return
      if (showcase.key === key && showcase.playing) showcaseRef.current.pause()
      else showcaseRef.current.playTrack(cfg)
    },
    [chorus, showcase],
  )

  // play/stop button that routes to the showcase player when the slide is in showcase mode
  const playBtn = (track, size) => {
    const cfgKey = chorus?.tracks?.[track.key] ? track.key : null
    const dims = size === 'lg' ? 'h-14 w-14 text-xl' : 'h-9 w-9 text-base'
    // B-side (or any track) without a video: show the ⚠ add-link button, never a dead ▶
    if (!cfgKey) {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation()
            const url = prompt(
              `No YouTube link found for "${track.titleEn}".\nSearch YouTube for the song, paste the link here:`,
            )
            if (url) {
              if (extractVideoId(url)) {
                setOverride(track.key, url)
                location.reload()
              } else {
                alert('That does not look like a YouTube link.')
              }
            }
          }}
          className={`shrink-0 flex items-center justify-center rounded-full border border-dashed border-slate-400/60 text-slate-300 hover:border-pink-300 hover:text-pink-200 transition-all ${dims}`}
          title="Sample missing — click to paste a YouTube link"
        >
          ⚠
        </button>
      )
    }
    const isCur = showcase.key === track.key
    const isPlaying = isCur && showcase.playing
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          if (cfgKey) showcaseToggle(track.key)
        }}
        className={`shrink-0 flex items-center justify-center rounded-full border transition-all ${dims} ${
          isPlaying
            ? 'bg-pink-500 border-pink-300 text-white shadow-[0_0_18px_rgba(255,110,199,0.7)]'
            : 'border-pink-300/60 text-pink-200 hover:bg-pink-500/20 hover:shadow-[0_0_14px_rgba(255,110,199,0.4)]'
        }`}
        aria-label={isPlaying ? `stop ${track.titleEn}` : `play ${track.titleEn}`}
      >
        {isPlaying ? '■' : '▶'}
      </button>
    )
  }

  return (
    <div className="h-full flex items-stretch gap-10 px-20 py-12">
      {/* left column: info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
      <div className="flex items-center gap-10">
        {slidePlaying ? (
          <div className="shrink-0 w-[22rem]">
            <div className="rounded-2xl overflow-hidden border border-white/15 shadow-[0_0_60px_rgba(255,110,199,0.25)] aspect-video bg-black">
              <div ref={videoSlotRef} className="w-full h-full" />
            </div>
            {player.current && (
              <p className="text-center font-display tracking-[0.2em] text-xs text-pink-200 truncate mt-3 px-2">
                ♪ {player.current.title}
              </p>
            )}
          </div>
        ) : (
          <SingleCover single={single} track={aSide} />
        )}
        <div className="min-w-0">
          <div className="flex items-baseline gap-5">
            <span className="font-display text-teal-300/80 text-3xl">#{String(single.num).padStart(2, '0')}</span>
            <p className="jp text-7xl font-bold text-white neon-pink leading-tight">{single.titleJp || single.titleEn}</p>
          </div>
          {single.titleJp && <p className="text-4xl text-slate-200 mt-2 font-display">{single.titleEn}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-5">
        <span className="chip">{single.releaseDate}</span>
        {single.peak && <span className="chip chip-hit">Oricon {single.peak}</span>}
        {single.sales && <span className="chip">{single.sales} copies</span>}
        {single.riaj && <span className={`chip ${riajChip(single.riaj)}`}>{single.riaj}</span>}
      </div>

      {/* A-side */}
      <div
        className="card p-8 mt-8 max-w-5xl"
      >
        <div className="flex items-start justify-between gap-8">
          <div className="min-w-0">
            <p className="text-sm tracking-[0.3em] text-pink-300/90 mb-2 font-display">A-SIDE</p>
            <p className="text-3xl font-semibold">
              {aSide.titleEn}
              {aSide.titleJp && aSide.titleJp !== aSide.titleEn && (
                <span className="jp text-slate-400 text-2xl ml-3">{aSide.titleJp}</span>
              )}
            </p>
            <div className="mt-4">
              <TrackDetails track={aSide} onPlayOriginal={chorus ? showcasePlayOriginal : null} />
            </div>
          </div>
          {chorus ? playBtn(aSide, 'lg') : <PlayButton track={aSide} size="lg" />}
        </div>
      </div>

      {/* B-side */}
      {bSide && (
        <div className="card px-8 py-5 mt-4 max-w-5xl opacity-95">
          <div className="flex items-start justify-between gap-8">
            <div className="min-w-0">
              <p className="text-xs tracking-[0.3em] text-slate-400 mb-1 font-display">B-SIDE</p>
              <p className="text-xl font-semibold">
                {bSide.titleEn}
                {bSide.titleJp && <span className="jp text-slate-400 text-lg ml-3">{bSide.titleJp}</span>}
              </p>
              {(bSide.original || bSide.credits || bSide.notes || bSide.videoId) && (
                <div className="mt-2">
                  <TrackDetails track={bSide} dense onPlayOriginal={chorus ? showcasePlayOriginal : null} />
                </div>
              )}
            </div>
            {chorus ? playBtn(bSide) : <PlayButton track={bSide} />}
          </div>
        </div>
      )}
      </div>

      {/* right column: full-size showcase player */}
      {chorus && (
        <div className="w-[44%] shrink-0 flex flex-col justify-center min-h-0">
          <ChorusSamplePlayer ref={showcaseRef} onStateChange={onShowcaseState} />
        </div>
      )}
    </div>
  )
}

/** Cover art for a single: prefers the original local artwork, falls back to the A-side YouTube thumbnail. */
function SingleCover({ single, track }) {
  const id = track?.videoId
  const [errCount, setErrCount] = useState(0)
  if (single.coverImage) {
    return (
      <div className="shrink-0 w-[22rem]">
        <div className="rounded-2xl overflow-hidden border border-white/15 shadow-[0_0_60px_rgba(255,110,199,0.2)] aspect-square bg-gradient-to-br from-purple-900/60 to-navy-900/80">
          <img
            src={single.coverImage}
            alt={`${single.titleEn} single cover`}
            className="w-full h-full object-cover"
          />
        </div>
        <p className="text-center font-display tracking-[0.35em] text-xs text-slate-500 mt-4">ORIGINAL ARTWORK</p>
      </div>
    )
  }
  if (!id || errCount >= 2) {
    // graceful fallback: neon placeholder card
    return (
      <div className="shrink-0 w-[22rem] aspect-square rounded-2xl border border-white/15 bg-gradient-to-br from-pink-900/50 to-navy-900/80 flex flex-col items-center justify-center gap-3">
        <p className="jp text-5xl font-bold text-white/90 neon-pink text-center px-8">{single.titleJp || single.titleEn}</p>
        <p className="font-display tracking-[0.3em] text-teal-200/70">WINK · SINGLE</p>
      </div>
    )
  }
  const src = errCount === 0 ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
  return (
    <div className="shrink-0 w-[22rem]">
      <div className="rounded-2xl overflow-hidden border border-white/15 shadow-[0_0_60px_rgba(255,110,199,0.2)] aspect-square bg-gradient-to-br from-purple-900/60 to-navy-900/80">
        <img
          src={src}
          alt={`${track.titleEn} single cover`}
          className="w-full h-full object-cover"
          onError={() => setErrCount((c) => c + 1)}
        />
      </div>
      <p className="text-center font-display tracking-[0.35em] text-xs text-slate-500 mt-4">A-SIDE ARTWORK</p>
    </div>
  )
}