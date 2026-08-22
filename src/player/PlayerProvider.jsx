import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { loadYT } from './yt.js'

const PlayerCtx = createContext(null)

/**
 * Global YouTube-based player. One shared hidden player; playing a new item
 * replaces the old one. A queue can be supplied so albums auto-advance.
 */
export function PlayerProvider({ children }) {
  const [current, setCurrent] = useState(null) // {key, videoId, title, meta}
  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)
  const playerRef = useRef(null)
  const hostRef = useRef(null)
  const queueRef = useRef([])
  const idxRef = useRef(-1)
  const pendingRef = useRef(null)

  const stop = useCallback(() => {
    try {
      playerRef.current?.pauseVideo()
    } catch {
      /* ignore */
    }
    queueRef.current = []
    idxRef.current = -1
    pendingRef.current = null
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
    setCurrent(item)
    setPlaying(true)
    try {
      playerRef.current?.loadVideoById(item.videoId)
      playerRef.current?.playVideo()
    } catch {
      pendingRef.current = item.videoId
    }
  }, [stop])

  const play = useCallback((queue, i = 0) => {
    queueRef.current = queue
    playIndex(i)
  }, [playIndex])

  const advance = useCallback(() => {
    playIndex(idxRef.current + 1)
  }, [playIndex])

  // create the shared player once
  useEffect(() => {
    let dead = false
    loadYT().then((YT) => {
      if (dead || !hostRef.current) return
      playerRef.current = new YT.Player(hostRef.current, {
        height: '180',
        width: '320',
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: (e) => {
            setReady(true)
            if (pendingRef.current) {
              e.target.loadVideoById(pendingRef.current)
              e.target.playVideo()
              pendingRef.current = null
            }
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) setPlaying(true)
            else if (e.data === YT.PlayerState.ENDED) advance()
            else if (e.data === YT.PlayerState.PAUSED) setPlaying(false)
          },
        },
      })
    })
    return () => {
      dead = true
    }
  }, [advance])

  const toggle = useCallback(
    (queue, i) => {
      const cur = queue[i]
      if (current?.key === cur?.key && playing) stop()
      else play(queue, i)
    },
    [current, playing, play, stop],
  )

  return (
    <PlayerCtx.Provider value={{ current, playing, ready, play, toggle, stop, advance }}>
      {children}
      {/*
        The YT.Player replaces the host div with an iframe, so React must never
        insert/remove siblings of that div. Keep the "now playing" header in a
        SEPARATE fixed element and keep the host div an only child of its own
        stable wrapper.
      */}
      {current && (
        <div className="fixed right-6 bottom-[19rem] z-40 card px-3 py-1.5 shadow-[0_0_40px_rgba(255,110,199,0.35)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-display text-pink-200 truncate max-w-[18rem]">♪ {current.title}</p>
            <button onClick={stop} aria-label="stop" className="text-slate-400 hover:text-pink-300 text-xs px-1">
              ✕
            </button>
          </div>
        </div>
      )}
      {/* host must stay mounted so the shared YT.Player survives */}
      <div
        className={`fixed right-6 bottom-24 z-40 card p-2 shadow-[0_0_40px_rgba(255,110,199,0.35)] ${
          current ? '' : 'hidden'
        }`}
      >
        <div ref={hostRef} />
      </div>
    </PlayerCtx.Provider>
  )
}

export function usePlayer() {
  return useContext(PlayerCtx)
}
