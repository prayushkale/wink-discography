import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { loadYT } from './yt.js'

const PlayerCtx = createContext(null)

/**
 * Global YouTube-based player. One shared player; playing a new item replaces
 * the old one. A queue can be supplied so albums auto-advance.
 *
 * The player iframe lives in a movable wrapper. By default it sits in a fixed
 * bottom-right "mini player"; a slide can call attachHost(el) to move it into
 * an on-slide container (e.g. in place of album artwork) and detachHost() to
 * return it. YouTube iframes reset when reparented, so each move recreates the
 * player and resumes the same video from the same position.
 */
export function PlayerProvider({ children }) {
  const [current, setCurrent] = useState(null) // {key, videoId, title, meta}
  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)
  const [attached, setAttached] = useState(false) // player currently living inside a slide

  const playerRef = useRef(null)
  const hostRef = useRef(null) // element the YT.Player is created on
  const wrapRef = useRef(null) // movable wrapper containing hostRef
  const homeRef = useRef(null) // fixed home position for the wrapper
  const queueRef = useRef([])
  const idxRef = useRef(-1)
  const pendingRef = useRef(null)
  const currentRef = useRef(null)
  // the chorus start last requested for the current item. If the player is
  // respawned (attachHost/detachHost) before playback has actually reached
  // that point, spawn must re-apply it instead of resuming from ~0.
  const startTargetRef = useRef(null)
  const playingRef = useRef(false)
  const ytReadyRef = useRef(false)

  currentRef.current = current
  playingRef.current = playing

  // (re)create the YT.Player, resuming current state. YT.Player REPLACES its
  // host element with an iframe, so a fresh host div is built inside the
  // movable wrapper on every spawn.
  const spawnPlayer = useCallback((startSeconds = 0) => {
    if (!wrapRef.current) return
    const prev = playerRef.current
    const resumeId = currentRef.current?.videoId
    const resumePlaying = playingRef.current
    // if we were asked to start at a chorus point and the player hasn't yet
    // played into it (e.g. it just got loadVideoById'd and is being reparented
    // immediately), re-apply the chorus start rather than resuming from ~0.
    const target = startTargetRef.current
    const effStart = target != null && startSeconds < target ? target : startSeconds
    if (prev) {
      try {
        prev.destroy()
      } catch {
        /* ignore */
      }
      playerRef.current = null
    }
    const host = document.createElement('div')
    // explicit size + absolute fill — the YT iframe is sized against this
    // element, and pinning it keeps stray sibling divs from offsetting it
    host.style.position = 'absolute'
    host.style.inset = '0'
    host.style.width = '100%'
    host.style.height = '100%'
    wrapRef.current.appendChild(host)
    hostRef.current = host
    loadYT().then((YT) => {
      if (!hostRef.current || hostRef.current !== host || !host.isConnected) return
      const opts = {
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: resumePlaying ? 1 : 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          origin: window.location.origin,
          ...(effStart ? { start: Math.floor(effStart) } : {}),
        },
        events: {
          onReady: (e) => {
            setReady(true)
            ytReadyRef.current = true
            if (pendingRef.current) {
              const item = pendingRef.current
              pendingRef.current = null
              if (item?.videoId) {
                if (item.chorusStart) startTargetRef.current = item.chorusStart
                e.target.loadVideoById(
                  item.chorusStart ? { videoId: item.videoId, startSeconds: item.chorusStart } : item.videoId,
                )
                e.target.playVideo()
              }
            }
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) setPlaying(true)
            else if (e.data === YT.PlayerState.ENDED) advance()
            else if (e.data === YT.PlayerState.PAUSED) setPlaying(false)
          },
        },
      }
      // videoId must be omitted entirely when absent — passing undefined
      // makes the YT API throw "Invalid video id"
      if (resumeId) opts.videoId = resumeId
      playerRef.current = new YT.Player(host, opts)
    })
  }, [])

  const stop = useCallback(() => {
    try {
      playerRef.current?.pauseVideo()
    } catch {
      /* ignore */
    }
    queueRef.current = []
    idxRef.current = -1
    pendingRef.current = null
    startTargetRef.current = null
    setCurrent(null)
    setPlaying(false)
  }, [])

  const playIndex = useCallback((i) => {
    const q = queueRef.current
    if (i < 0 || i >= q.length) {
      stop()
      return
    }
    idxRef.current = i
    const item = q[i]
    if (!item?.videoId) return
    setCurrent(item.title ? item : { ...item, title: item.titleEn ?? item.titleJp ?? 'Unknown track' })
    setPlaying(true)
    // Start every video exactly at its estimated chorus time (no jitter) so
    // playback is deterministic and always lands on the first chorus.
    const startSeconds = item.chorusStart ?? null
    startTargetRef.current = startSeconds || null
    try {
      playerRef.current?.loadVideoById(
        startSeconds ? { videoId: item.videoId, startSeconds } : item.videoId,
      )
      playerRef.current?.playVideo()
    } catch {
      pendingRef.current = item
    }
  }, [stop])

  const play = useCallback((queue, i = 0) => {
    queueRef.current = queue
    playIndex(i)
  }, [playIndex])

  const advance = useCallback(() => {
    playIndex(idxRef.current + 1)
  }, [playIndex])
  // move the player into an on-slide container (or back to its fixed home)
  const attachHost = useCallback((el) => {
    if (!el || !wrapRef.current || wrapRef.current.parentElement === el) return
    // capture position so playback resumes seamlessly after the iframe reset
    let t = 0
    try {
      t = playerRef.current?.getCurrentTime?.() ?? 0
    } catch {
      /* ignore */
    }
    el.appendChild(wrapRef.current)
    setAttached(true)
    spawnPlayer(t)
  }, [spawnPlayer])

  const detachHost = useCallback(() => {
    if (!wrapRef.current || !homeRef.current || wrapRef.current.parentElement === homeRef.current) return
    let t = 0
    try {
      t = playerRef.current?.getCurrentTime?.() ?? 0
    } catch {
      /* ignore */
    }
    homeRef.current.appendChild(wrapRef.current)
    setAttached(false)
    spawnPlayer(t)
  }, [spawnPlayer])

  // create the shared player once (in its home position)
  useEffect(() => {
    spawnPlayer(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = useCallback(
    (queue, i) => {
      const cur = queue[i]
      if (current?.key === cur?.key && playing) stop()
      else play(queue, i)
    },
    [current, playing, play, stop],
  )

  // keep the context value stable between renders: slides key effects off
  // `player`, so a fresh object every render would re-run attach/detach effects
  // and constantly tear down the YouTube iframe mid-playback.
  const value = useMemo(
    () => ({ current, playing, ready, attached, play, toggle, stop, advance, attachHost, detachHost }),
    [current, playing, ready, attached, play, toggle, stop, advance, attachHost, detachHost],
  )

  return (
    <PlayerCtx.Provider value={value}>
      {children}
      {/*
        The YT.Player replaces the host div with an iframe, so React must never
        insert/remove siblings of that div. The "now playing" header lives in a
        SEPARATE fixed element and the host div stays an only child of its own
        stable wrapper (which slides may reparent via attachHost).
      */}
      {current && !attached && (
        <div className="fixed right-6 bottom-[19rem] z-40 card px-3 py-1.5 shadow-[0_0_40px_rgba(255,110,199,0.35)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-display text-pink-200 truncate max-w-[18rem]">♪ {current.title}</p>
            <button onClick={stop} aria-label="stop" className="text-slate-400 hover:text-pink-300 text-xs px-1">
              ✕
            </button>
          </div>
        </div>
      )}
      {/* home position of the movable player wrapper (hidden while attached to a slide) */}
      <div
        ref={homeRef}
        className={`fixed right-6 bottom-24 z-40 card p-2 shadow-[0_0_40px_rgba(255,110,199,0.35)] ${
          current && !attached ? '' : 'hidden'
        }`}
      >
        <div ref={wrapRef} className={attached ? 'relative w-full h-full' : ''}>
          <div ref={hostRef} />
        </div>
      </div>
    </PlayerCtx.Provider>
  )
}

export function usePlayer() {
  return useContext(PlayerCtx)
}
