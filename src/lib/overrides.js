import builtin from '../data/video-overrides.json'

/**
 * User-supplied YouTube links, persisted in localStorage.
 * Keys are stable ids like "single-23" or "album-05-track-03".
 */
const LS_KEY = 'wink-video-links'

export function getOverrides() {
  let user = {}
  try {
    user = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
  } catch {
    /* ignore */
  }
  return { ...builtin, ...user }
}

export function setOverride(key, url) {
  let user = {}
  try {
    user = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
  } catch {
    /* ignore */
  }
  user[key] = url
  localStorage.setItem(LS_KEY, JSON.stringify(user))
}
