import { useEffect, useMemo, useRef, useState } from 'react'
import { PlayButton, TrackDetails, riajChip } from '../TrackBits.jsx'
import { usePlayer } from '../../player/PlayerProvider.jsx'
import { getSavedChorusStarts, setChorusStart as persistChorusStart } from '../../lib/chorusStarts.js'
import ChorusStartEditor from '../ChorusStartEditor.jsx'

export default function AlbumSlide({ entry, tracks, albumPrefix, editor }) {
  const { album, coverSlug } = entry
  const player = usePlayer()
  const videoSlotRef = useRef(null)

  // chorus-start tuner (VITE_CHORUS_EDIT=1): per-track overrides applied on
  // top of the builtin ALBUM_CHORUS_STARTS estimates. Save persists + applies
  // immediately, so the album queue and row play buttons use the tuned start.
  const savedStarts = getSavedChorusStarts()
  const [startOverrides, setStartOverrides] = useState({})
  const saveStart = (trackKey, seconds) => {
    if (persistChorusStart(trackKey, seconds)) {
      setStartOverrides((prev) => ({ ...prev, [trackKey]: seconds }))
    }
  }
  const effectiveTracks = useMemo(
    () =>
      tracks.map((t) =>
        startOverrides[t.key] != null ? { ...t, chorusStart: startOverrides[t.key] } : t,
      ),
    [tracks, startOverrides],
  )
  const playable = useMemo(() => effectiveTracks.filter((t) => t.videoId), [effectiveTracks])
  const playingKey = player.current?.key
  const albumPlaying = Boolean(albumPrefix && playingKey?.startsWith(albumPrefix))

  // While an album track is playing, host the shared YouTube player in place
  // of the cover art (left side). When playback stops, the artwork returns.
  // Depends only on stable callbacks — not the whole context object.
  const { attachHost, detachHost } = player
  useEffect(() => {
    if (albumPlaying && videoSlotRef.current) attachHost(videoSlotRef.current)
    else detachHost()
  }, [albumPlaying, attachHost, detachHost])
  // navigating away from the slide: return the player to its home position
  useEffect(() => () => detachHost(), [detachHost])

  const playAlbum = () => {
    if (albumPlaying) player.stop()
    else if (playable.length) player.play(playable, 0)
  }

  return (
    <div className="h-full flex items-center gap-12 px-20 py-10">
      {/* cover art — replaced by the playing video while a track is active */}
      <div className="shrink-0 w-[32rem]">
        <div
          className={`relative rounded-2xl overflow-hidden border border-white/15 shadow-[0_0_60px_rgba(94,234,212,0.15)] bg-black flex items-center justify-center ${
            albumPlaying ? 'aspect-video' : 'aspect-square'
          }`}
        >
          {albumPlaying ? (
            <div ref={videoSlotRef} className="w-full h-full" />
          ) : (
            <img
              src={`/covers/${coverSlug}`}
              alt={`${album.titleEn} cover`}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          )}
        </div>
        {albumPlaying && player.current && (
          <p className="font-display tracking-[0.2em] text-xs text-pink-200 truncate mt-3 px-3 text-center">
            ♪ {player.current.title}
          </p>
        )}
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
                {editor && (
                  <ChorusStartEditor
                    track={t}
                    start={startOverrides[t.key] ?? t.chorusStart}
                    onSave={(s) => saveStart(t.key, s)}
                  />
                )}
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
