/** Load the YouTube IFrame API once. */
let apiPromise = null
export function loadYT() {
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve(window.YT)
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(window.YT)
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    tag.async = true
    document.head.appendChild(tag)
  })
  return apiPromise
}

/** Extract an 11-char video id from any common YouTube URL form. */
export function extractVideoId(url) {
  if (!url) return null
  const idMatch = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/)
  if (idMatch) return idMatch[1]
  if (/^[A-Za-z0-9_-]{11}$/.test(url.trim())) return url.trim()
  return null
}
