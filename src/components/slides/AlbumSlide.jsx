import { useMemo } from 'react'
import { PlayButton, TrackDetails, riajChip } from '../TrackBits.jsx'
import { usePlayer } from '../../player/PlayerProvider.jsx'

export default function AlbumSlide({ entry, tracks }) {
  const { album, coverSlug } = entry
  const player = usePlayer()

  const playable = useMemo(() => tracks.filter((t) => t.videoId), [tracks])
  const playingKey = player.current?.key
  const albumPlaying = playingKey?.startsWith(entry.albumPrefix)

  const playAlbum = () => {
    if (albumPlaying) player.stop()
    else if (playable.length) player.play(playable, 0)
  }

  return (
    <div className="h-full flex items-center gap-12 px-20 py-10">
      {/* cover art */}
      <div className="shrink-0 w-[32rem]">
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
          <p className="jp text-4xl font-bold text-white neon-cyan">{album.titleJp || album.titleEn}</p>
          {album.titleJp && <p className="font-display text-2xl text-slate-300">{album.titleEn}</p>}
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="chip">{album.released}</span>
            {album.peak && <span className="chip chip-hit">Oricon {album.peak}</span>}
            {album.sales && <span className="chip">{album.sales} copies</span>}
            {album.riaj && <span className={`chip ${riajChip(album.riaj)}`}>{album.riaj}</span>}
          </div>
          <button
            onClick={playAlbum}
            className={`mt-5 w-full py-3 rounded-xl font-display tracking-[0.25em] text-lg border transition-all ${
              albumPlaying
                ? 'bg-pink-500/90 border-pink-300 text-white shadow-[0_0_24px_rgba(255,110,199,0.6)]'
                : 'border-pink-300/60 text-pink-200 hover:bg-pink-500/20'
            }`}
          >
            {albumPlaying ? '■ STOP ALBUM' : `▶ PLAY ALBUM (${playable.length} SAMPLE${playable.length === 1 ? '' : 'S'})`}
          </button>
          <p className="text-xs text-slate-500 mt-2">
            Tracks play one by one · the playing track expands with full details
          </p>
        </div>
      </div>

      {/* tracklist */}
      <div className="flex-1 min-w-0">
        <p className="text-xs tracking-[0.4em] text-teal-300/80 mb-3 font-display">TRACKLIST · {tracks.length} TRACKS</p>
        <ol className="space-y-1.5 max-h-[76vh] overflow-y-auto pr-3">
          {tracks.map((t) => {
            const active = playingKey === t.key
            return (
              <li
                key={t.key ?? t.titleEn}
                className={`card transition-all ${
                  active ? 'px-6 py-4 ring-1 ring-pink-400/50 shadow-[0_0_24px_rgba(255,110,199,0.25)]' : 'px-5 py-3'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate">
                      <span className="font-display text-base text-pink-300/80 mr-3">
                        {String(t.no ?? '·').padStart(2, '0')}
                      </span>
                      <span className={`text-lg ${active ? 'text-white font-semibold' : 'text-slate-200'}`}>
                        {t.titleEn}
                      </span>
                      {t.titleJp && t.titleJp !== t.titleEn && (
                        <span className="jp text-base text-slate-400 ml-2">{t.titleJp}</span>
                      )}
                      {t.soloMember && (
                        <span className="chip chip-hit text-xs ml-2 !py-0 !px-2">{t.soloMember.split(' ')[1]} solo</span>
                      )}
                    </p>
                    {!active && (
                      <p className="text-sm text-slate-500 truncate pl-8">
                        {t.videoId
                          ? t.original
                            ? `cover of: ${t.original.replace(/—\s*$/, '')}`
                            : t.type?.includes('single')
                              ? '♪ single version'
                              : ''
                          : 'sample link missing'}
                      </p>
                    )}
                  </div>
                  <PlayButton track={t} queue={playable} size="sm" />
                </div>
                {active && (
                  <div className="mt-3 pl-8 border-t border-white/10 pt-3">
                    <TrackDetails track={t} dense />
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
