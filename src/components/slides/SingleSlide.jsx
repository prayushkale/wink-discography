import SamplePlayer from '../SamplePlayer.jsx'

const riajClass = (r) => (r === 'Platinum' ? 'chip-platinum' : r === 'Gold' ? 'chip-gold' : 'chip')

export default function SingleSlide({ single, sample }) {
  const aSide = single.tracks[0]
  const bSide = single.tracks[1]
  return (
    <div className="h-full flex flex-col justify-center px-20 py-10">
      <div className="flex items-baseline gap-4">
        <span className="font-display text-teal-300/70 text-lg">#{String(single.num).padStart(2, '0')}</span>
        <p className="jp text-5xl font-bold text-white neon-pink">{single.titleJp || single.titleEn}</p>
      </div>
      {single.titleJp && <p className="text-2xl text-slate-300 mt-1 font-display">{single.titleEn}</p>}

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <span className="chip">{single.releaseDate}</span>
        {single.peak && <span className="chip chip-hit">Oricon {single.peak}</span>}
        {single.sales && <span className="chip">{single.sales} copies</span>}
        {single.riaj && <span className={`chip ${riajClass(single.riaj)}`}>{single.riaj}</span>}
      </div>

      <div className="card p-6 mt-6 max-w-4xl">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div>
            <p className="text-[10px] tracking-[0.3em] text-pink-300/80 mb-1">A-SIDE</p>
            <p className="text-xl font-semibold">
              {aSide.titleEn}
              {aSide.titleJp && aSide.titleJp !== aSide.titleEn && (
                <span className="jp text-slate-400 text-base ml-2">{aSide.titleJp}</span>
              )}
            </p>
            {aSide.original && <p className="text-xs text-slate-400 mt-1">cover of: {aSide.original.replace(/—\s*$/, '')}</p>}
          </div>
          <SamplePlayer sample={sample} title={aSide.titleEn} />
        </div>
        {aSide.credits && <p className="jp text-xs text-slate-500 mt-4 leading-relaxed">{aSide.credits}</p>}
        {aSide.notes && <p className="text-xs text-teal-200/60 mt-2 leading-relaxed">{aSide.notes}</p>}
      </div>

      {bSide && (
        <div className="card px-6 py-3 mt-3 max-w-4xl opacity-80">
          <p className="text-[10px] tracking-[0.3em] text-slate-500 mb-0.5">B-SIDE</p>
          <p className="text-sm text-slate-300">
            {bSide.titleEn}
            {bSide.titleJp && <span className="jp text-slate-500 ml-2">{bSide.titleJp}</span>}
            {bSide.original && <span className="text-slate-500 text-xs ml-3">cover of: {bSide.original.replace(/—\s*$/, '')}</span>}
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 mt-4">
        {single.pvUrl && (
          <a
            href={single.pvUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-pink-300 hover:text-pink-200 underline decoration-dotted"
          >
            ▶ watch PV on YouTube
          </a>
        )}
      </div>
    </div>
  )
}
