import { useState } from 'react'
import { PlayButton, TrackDetails, riajChip } from '../TrackBits.jsx'

export default function SingleSlide({ single, tracks }) {
  const aSide = tracks[0]
  const bSide = tracks[1]

  return (
    <div className="h-full flex items-center gap-10 px-20 py-12">
      {/* left column: info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
      <div className="flex items-baseline gap-5">
        <span className="font-display text-teal-300/80 text-3xl">#{String(single.num).padStart(2, '0')}</span>
        <p className="jp text-7xl font-bold text-white neon-pink leading-tight">{single.titleJp || single.titleEn}</p>
      </div>
      {single.titleJp && <p className="text-4xl text-slate-200 mt-2 font-display">{single.titleEn}</p>}

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
              <TrackDetails track={aSide} />
            </div>
          </div>
          <PlayButton track={aSide} size="lg" />
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
                  <TrackDetails track={bSide} dense />
                </div>
              )}
            </div>
            <PlayButton track={bSide} />
          </div>
        </div>
      )}
      </div>

      {/* right column: single artwork (YouTube thumbnail of the A-side) */}
      <SingleCover single={single} track={aSide} />
    </div>
  )
}

/** Cover art for a single: derived from the A-side YouTube video thumbnail. */
function SingleCover({ single, track }) {
  const id = track?.videoId
  const [errCount, setErrCount] = useState(0)
  if (!id || errCount >= 2) {
    // graceful fallback: neon placeholder card
    return (
      <div className="shrink-0 w-[26rem] aspect-square rounded-2xl border border-white/15 bg-gradient-to-br from-pink-900/50 to-navy-900/80 flex flex-col items-center justify-center gap-3">
        <p className="jp text-5xl font-bold text-white/90 neon-pink text-center px-8">{single.titleJp || single.titleEn}</p>
        <p className="font-display tracking-[0.3em] text-teal-200/70">WINK · SINGLE</p>
      </div>
    )
  }
  const src = errCount === 0 ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
  return (
    <div className="shrink-0 w-[26rem]">
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
