/**
 * User-adjusted chorus start seconds (per single), persisted in localStorage.
 * Keys are "single-{NN}" matching the CHORUS_STARTS map in App.jsx.
 *
 * These override the built-in structural estimates in CHORUS_STARTS so a
 * value tuned with the dev-only chorus editor (VITE_CHORUS_EDIT=1) survives
 * a clean run: buildSlides() merges these over the builtin map, so every
 * chorus clip starts at the tuned second even when the editor UI is hidden.
 */
const LS_KEY = 'wink-chorus-starts'

export function getSavedChorusStarts() {
  let user = {}
  try {
    user = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
  } catch {
    /* ignore */
  }
  return user
}

/** Persist a per-single chorus start (seconds >= 0). Returns false on a bad value. */
export function setChorusStart(key, seconds) {
  const n = Number(seconds)
  if (!Number.isFinite(n) || n < 0) return false
  const user = getSavedChorusStarts()
  user[key] = Math.round(n * 100) / 100
  localStorage.setItem(LS_KEY, JSON.stringify(user))
  return true
}
