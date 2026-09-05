import { usePlayer } from '../player/PlayerProvider.jsx'
import { setOverride } from '../lib/overrides.js'
import { extractVideoId } from '../player/yt.js'

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** Round play/stop button for one track. Disabled with a "add link" prompt when no video. */
export function PlayButton({ track, queue, size = 'md' }) {
  const player = usePlayer()
  const isCur = player.current?.key === track.key
  const dims = size === 'sm' ? 'h-9 w-9 text-base' : 'h-14 w-14 text-xl'

  if (!track.videoId) {
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

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        player.toggle(queue ?? [track], queue ? queue.findIndex((t) => t.key === track.key) : 0)
      }}
      className={`shrink-0 flex items-center justify-center rounded-full border transition-all ${dims} ${
        isCur && player.playing
          ? 'bg-pink-500 border-pink-300 text-white shadow-[0_0_18px_rgba(255,110,199,0.7)]'
          : 'border-pink-300/60 text-pink-200 hover:bg-pink-500/20 hover:shadow-[0_0_14px_rgba(255,110,199,0.4)]'
      }`}
      aria-label={isCur && player.playing ? `stop ${track.titleEn}` : `play ${track.titleEn}`}
    >
      {isCur && player.playing ? '■' : '▶'}
    </button>
  )
}

/** All the rich metadata we have about one recording. */
export function TrackDetails({ track, dense = false, onPlayOriginal = null }) {
  const clean = (s) => (s || '').replace(/—\s*$/, '')
  const canPlayOriginal = Boolean(onPlayOriginal && track.originalVideoId)
  return (
    <div className={`space-y-${dense ? '1' : '1.5'} ${dense ? 'text-xs' : 'text-sm'} text-slate-300`}>
      <p>
        <span className="text-pink-300/80 font-display tracking-widest text-[0.7em] mr-2">ORIGINAL</span>
        {clean(track.original) || '—'}
        {canPlayOriginal && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onPlayOriginal(track)
            }}
            className="ml-2 text-teal-300 hover:text-teal-200 underline decoration-dotted"
            title={`Play the original in the side player (from ${fmt(track.originalStartSeconds)})`}
          >
            ▶ hear the original
          </button>
        )}
        {track.originalVideo && !canPlayOriginal && (
          <a
            href={track.originalVideo}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ml-2 text-teal-300 hover:text-teal-200 underline decoration-dotted"
          >
            ▶ hear the original
          </a>
        )}
      </p>
      {track.credits && (
        <p className="jp leading-relaxed">
          <span className="text-teal-300/80 font-display tracking-widest text-[0.7em] not-italic mr-2">CREDITS</span>
          {track.credits}
        </p>
      )}
      {track.chart && (
        <p>
          <span className="text-teal-300/80 font-display tracking-widest text-[0.7em] mr-2">CHART</span>
          {track.chart}
        </p>
      )}
      {track.notes && (
        <p className="leading-relaxed text-slate-400">
          <span className="text-pink-300/80 font-display tracking-widest text-[0.7em] mr-2">NOTES</span>
          {track.notes}
        </p>
      )}
      <div className="flex gap-4 pt-1">
        {track.video && (
          <a
            href={track.video}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-pink-300 hover:text-pink-200 underline decoration-dotted"
          >
            ▶ watch on YouTube
          </a>
        )}
        {track.release && <span className="text-slate-500">released {track.release}</span>}
      </div>
    </div>
  )
}

export const riajChip = (r) => (r === 'Platinum' ? 'chip-platinum' : r === 'Gold' ? 'chip-gold' : 'chip')
