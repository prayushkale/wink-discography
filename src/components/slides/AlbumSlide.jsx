import SamplePlayer from '../SamplePlayer.jsx'

export default function AlbumSlide({ entry, tracks }) {
  const { album, coverSlug } = entry
  return (
    <div className="h-full flex items-center gap-12 px-20 py-8">
      {/* cover art */}
      <div className="shrink-0 w-[30rem]">
        <div className="rounded-2xl overflow-hidden border border-white/15 shadow-[0_0_60px_rgba(94,234,212,0.15)] aspect-square bg-gradient-to-br from-purple-900/60 to-navy-900/80 flex items-center justify-center">
          <img
            src={`/covers/${coverSlug}`}
            alt={`${album.titleEn} cover`}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        </div>
        <div className="mt-5">
          <p className="jp text-3xl font-bold text-white neon-cyan">{album.titleJp || album.titleEn}</p>
          {album.titleJp && <p className="font-display text-xl text-slate-300">{album.titleEn}</p>}
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="chip">{album.released}</span>
            {album.peak && <span className="chip chip-hit">Oricon {album.peak}</span>}
            {album.sales && <span className="chip">{album.sales} copies</span>}
            {album.riaj && (
              <span className={`chip ${album.riaj === 'Platinum' ? 'chip-platinum' : 'chip-gold'}`}>{album.riaj}</span>
            )}
          </div>
        </div>
      </div>

      {/* tracklist */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] tracking-[0.4em] text-teal-300/70 mb-3 font-display">TRACKLIST · {tracks.length} TRACKS</p>
        <ol className="space-y-1 max-h-[78vh] overflow-y-auto pr-3">
          {tracks.map((t) => (
            <li key={t.no ?? t.titleEn} className="card px-4 py-2 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate">
                  <span className="font-display text-xs text-pink-300/70 mr-2">
                    {String(t.no ?? '·').padStart(2, '0')}
                  </span>
                  <span className="text-sm text-slate-200">{t.titleEn}</span>
                  {t.titleJp && t.titleJp !== t.titleEn && (
                    <span className="jp text-xs text-slate-500 ml-2">{t.titleJp}</span>
                  )}
                  {t.soloMember && (
                    <span className="chip chip-hit text-[10px] ml-2 !py-0 !px-2">{t.soloMember.split(' ')[1]} solo</span>
                  )}
                </p>
                {(t.original || t.type?.includes('single')) && (
                  <p className="text-[11px] text-slate-500 truncate pl-7">
                    {t.video ? '♪ single' : t.original ? `cover of: ${t.original.replace(/—\s*$/, '')}` : ''}
                  </p>
                )}
              </div>
              <SamplePlayer sample={t.sample} title={t.titleEn} compact />
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
