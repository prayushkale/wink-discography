import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { loadYT } from '../player/yt.js'

/** Largest 16:9 box that fits inside w×h. */
const fit16x9 = (w, h) =>
  w / h > 16 / 9
    ? { width: Math.floor((h * 16) / 9), height: Math.floor(h) }
    : { width: Math.floor(w), height: Math.floor((w * 9) / 16) }

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/**
 * Full-bleed YouTube player for the single-slide chorus sampler. Occupies the
 * maximum width/height of whatever container it is placed in (kept 16:9 and
 * centered). On mount it auto-plays `autoTrack` from its estimated chorus
 * start; the song play buttons on the slide drive it via the imperative ref.
 *
 * This is separate from the shared PlayerProvider (which keeps the small
 * bottom "now playing" player for the rest of the deck).
 */
const ChorusSamplePlayer = forwardRef(function ChorusSamplePlayer(
  { autoTrack = null, onStateChange },
  ref,
) {
  const stageRef = useRef(null) // measured area (video + letterbox space)
  const hostRef = useRef(null) // element the YT.Player is created on
  const playerRef = useRef(null)
  const pendingRef = useRef(null)
  const autoRef = useRef(autoTrack)
  const currentRef = useRef(autoTrack)
  const endedRef = useRef(false)

  const [current, setCurrent] = useState(autoTrack)
  const [status, setStatus] = useState(autoTrack ? 'loading' : 'idle') // idle|loading|ready|playing|paused|error

  const applyCurrent = useCallback((track) => {
    currentRef.current = track
    setCurrent(track)
  }, [])

  // surface playback state to the parent (button icons etc.)
  useEffect(() => {
    onStateChange?.({ key: current?.key ?? null, playing: status === 'playing' })
  }, [current, status, onStateChange])

  // size the 16:9 stage to the largest box that fits its container
  useEffect(() => {
    const stage = stageRef.current
    const host = hostRef.current
    const apply = () => {
      const r = stage.getBoundingClientRect()
      if (!r.width || !r.height) return
      const f = fit16x9(r.width, r.height)
      if (!f.width || !f.height) return
      host.style.width = `${f.width}px`
      host.style.height = `${f.height}px`
    }
    const raf = requestAnimationFrame(apply)
    const ro = new ResizeObserver(apply)
    ro.observe(stage)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  const deadRef = useRef(false)
  const creatingRef = useRef(false)

  // create the YT.Player lazily. It must NOT be created without a videoId —
  // the API rejects that with "Invalid video id" and the player never works.
  const ensurePlayer = useCallback(() => {
    if (playerRef.current || creatingRef.current || deadRef.current) return
    creatingRef.current = true
    loadYT().then((YT) => {
      if (deadRef.current || !hostRef.current) return
      const vars = {
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        origin: window.location.origin,
      }
      if (autoRef.current) {
        vars.autoplay = 1
        vars.start = autoRef.current.startSeconds
      }
      ytPlayer = new YT.Player(hostRef.current, {
        width: '100%',
        height: '100%',
        videoId: autoRef.current?.videoId ?? pendingRef.current?.videoId,
        playerVars: vars,
        events: {
          onReady: (e) => {
            creatingRef.current = false
            if (deadRef.current) return
            playerRef.current = e.target
            // make the iframe fill the px-sized host
            const ifr = hostRef.current?.querySelector('iframe')
            if (ifr) {
              ifr.style.width = '100%'
              ifr.style.height = '100%'
            }
            if (pendingRef.current) {
              const tr = pendingRef.current
              pendingRef.current = null
              applyCurrent(tr)
              try {
                e.target.loadVideoById({ videoId: tr.videoId, startSeconds: tr.startSeconds })
                e.target.playVideo()
              } catch {
                /* ignore */
              }
            } else if (autoRef.current) {
              setStatus('loading')
            } else {
              setStatus('idle')
            }
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) {
              endedRef.current = false
              setStatus('playing')
            } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
              if (e.data === YT.PlayerState.ENDED) endedRef.current = true
              setStatus('paused')
            }
          },
          onError: () => {
            if (!deadRef.current) {
              endedRef.current = true // a dead clip must restart from the chorus, not "resume"
              setStatus('error')
            }
          },
        },
      })
      creatingRef.current = false
      if (!playerRef.current && autoRef.current) setStatus('loading')
    })
  }, [applyCurrent])

  // unmount: tear down any created player
  useEffect(() => {
    return () => {
      deadRef.current = true
      try {
        playerRef.current?.stopVideo()
        playerRef.current?.destroy()
      } catch {
        /* ignore */
      }
      playerRef.current = null
    }
  }, [])

  const playTrack = useCallback((track) => {
    // compare against the PREVIOUS current key (before applyCurrent overwrites it)
    const prevKey = currentRef.current?.key
    applyCurrent(track)
    setStatus('playing')
    ensurePlayer()
    const p = playerRef.current
    if (!p) {
      pendingRef.current = track // player not created/ready yet; load on onReady
      return
    }
    try {
      if (prevKey === track.key && !endedRef.current) {
        // same track, mid-playback (e.g. after pause): resume where it stopped
        p.playVideo()
      } else {
        endedRef.current = false
        p.loadVideoById({ videoId: track.videoId, startSeconds: track.startSeconds })
        p.playVideo()
      }
    } catch {
      /* ignore */
    }
  }, [applyCurrent, ensurePlayer])

  const pause = useCallback(() => {
    try {
      playerRef.current?.pauseVideo()
    } catch {
      /* ignore */
    }
  }, [])

  useImperativeHandle(ref, () => ({ playTrack, pause }), [playTrack, pause])

  const isPlaying = status === 'playing'
  const caption = current
    ? `${isPlaying ? '♪' : status === 'paused' ? '⏸' : '♪'} ${current.title} · chorus sample from ${fmt(current.startSeconds)}`
    : status === 'error'
      ? 'YouTube clip could not be loaded.'
      : autoTrack
        ? 'Loading the chorus sample…'
        : 'Pick a song — its sample starts at the chorus.'

  return (
    <div className="h-full w-full flex flex-col min-h-0">
      <div ref={stageRef} className="relative flex-1 min-h-0 w-full flex items-center justify-center">
        <div
          ref={hostRef}
          className="relative rounded-2xl overflow-hidden border border-white/15 bg-black shadow-[0_0_60px_rgba(94,234,212,0.18)]"
        />
        {status === 'error' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/70 text-slate-400 text-sm p-6 text-center pointer-events-none">
            This clip could not be loaded from YouTube.
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-4 px-1 pt-3 pb-1 shrink-0">
        <p className={`text-xs font-display tracking-[0.2em] truncate ${status === 'error' ? 'text-red-300' : 'text-teal-200/80'}`}>
          {caption}
        </p>
        {current && (
          <button
            onClick={() => (isPlaying ? pause() : playTrack(current))}
            aria-label={isPlaying ? 'pause chorus sample' : 'resume chorus sample'}
            className="shrink-0 text-xs font-display tracking-widest text-pink-200 hover:text-pink-100 border border-pink-300/50 rounded-full px-3 py-1"
          >
            {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
          </button>
        )}
      </div>
    </div>
  )
})

export default ChorusSamplePlayer
