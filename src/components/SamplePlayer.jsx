import { useEffect, useRef, useState } from 'react'

/** Shared audio element: playing one sample stops any other. */
let sharedAudio = null
let sharedStopHandler = null

export default function SamplePlayer({ sample, title, compact = false }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const raf = useRef(0)

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  if (!sample) return null

  const stop = () => {
    sharedAudio?.pause()
    if (sharedAudio) sharedAudio.currentTime = 0
    setPlaying(false)
    setProgress(0)
  }

  const toggle = () => {
    if (!sharedAudio) {
      sharedAudio = new Audio()
      sharedAudio.addEventListener('timeupdate', () => {
        if (!sharedAudio.duration) return
        setProgress(sharedAudio.currentTime / sharedAudio.duration)
      })
      sharedAudio.addEventListener('ended', () => {
        setPlaying(false)
        setProgress(0)
      })
    }
    if (playing) {
      stop()
      return
    }
    // stop whoever else is playing
    sharedStopHandler?.()
    sharedAudio.src = sample.src
    sharedAudio.play().catch(() => {})
    sharedStopHandler = stop
    setPlaying(true)
  }

  const size = compact ? 'text-sm' : ''

  return (
    <div className={`inline-flex items-center gap-3 ${size}`}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          toggle()
        }}
        className={`flex items-center justify-center rounded-full border transition-all ${
          compact ? 'h-7 w-7' : 'h-12 w-12'
        } ${
          playing
            ? 'bg-pink-500 border-pink-300 text-white shadow-[0_0_18px_rgba(255,110,199,0.7)]'
            : 'border-pink-300/60 text-pink-200 hover:bg-pink-500/20 hover:shadow-[0_0_14px_rgba(255,110,199,0.4)]'
        }`}
        aria-label={playing ? 'stop sample' : `play sample: ${title}`}
      >
        {playing ? '■' : '▶'}
      </button>
      <div className={`rounded-full bg-white/10 overflow-hidden ${compact ? 'h-1.5 w-24' : 'h-2 w-44'}`}>
        <div
          className="h-full bg-gradient-to-r from-pink-400 to-teal-300 transition-[width] duration-150"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <span className={`text-teal-200/80 font-display ${compact ? 'text-[10px]' : 'text-xs'}`}>
        {playing ? 'PLAYING' : 'SAMPLE'}
      </span>
    </div>
  )
}
