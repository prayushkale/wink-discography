import { useEffect, useRef, useState } from 'react'

/** Dev-only per-track chorus-start tuner (VITE_CHORUS_EDIT=1): type the second
 * at which THIS song's chorus should start and Save. The value is persisted to
 * localStorage (wink-chorus-starts) under the track key, so a clean run without
 * the flag hides this UI but still starts each song's chorus clip at its tuned
 * second. */
export default function ChorusStartEditor({ track, start, onSave }) {
  const [val, setVal] = useState(String(start))
  const [saved, setSaved] = useState(false)
  const timerRef = useRef(null)
  useEffect(() => {
    setVal(String(start))
  }, [start])
  useEffect(() => () => clearTimeout(timerRef.current), [])
  const save = () => {
    const trimmed = val.trim()
    const n = Number(trimmed)
    if (trimmed === '' || !Number.isFinite(n) || n < 0) {
      alert(`Enter the chorus start in seconds — a number ≥ 0 (e.g. 42).`)
      return
    }
    onSave(n)
    setSaved(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setSaved(false), 1500)
  }
  return (
    <div className="mt-2 flex items-center gap-2.5">
      <label
        htmlFor={`chorus-start-${track.key}`}
        className="text-[10px] font-display tracking-[0.25em] text-teal-300/70 shrink-0"
      >
        CHORUS START
      </label>
      <input
        id={`chorus-start-${track.key}`}
        type="number"
        min="0"
        step="1"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        aria-label={`chorus start seconds for ${track.titleEn}`}
        className="w-20 rounded-lg border border-pink-300/40 bg-black/40 px-2.5 py-1 text-center font-mono text-sm text-slate-100 outline-none focus:border-pink-300"
      />
      <span className="text-[10px] text-slate-500 -ml-1">sec</span>
      <button
        onClick={save}
        className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-display tracking-[0.2em] transition-all ${
          saved
            ? 'border-teal-300/70 bg-teal-400/15 text-teal-200'
            : 'border-teal-300/50 text-teal-200/90 hover:bg-teal-400/15 hover:text-teal-100'
        }`}
      >
        {saved ? 'SAVED ✓' : 'SAVE'}
      </button>
    </div>
  )
}
