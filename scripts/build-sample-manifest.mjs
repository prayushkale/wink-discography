#!/usr/bin/env node
/**
 * Build scripts/sample-jobs.tsv (unique YouTube PVs -> download jobs)
 * and download album cover art into public/covers/.
 *
 * Song keys used later in samples.json:
 *   single-{n}            -> single #n A-side
 *   album-{i}-track-{nn}  -> studio album i (1-based, chronological) track nn
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(readFileSync(path.join(ROOT, 'src/data/discography.json'), 'utf8'))

const slugify = (t) =>
  t
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'song'

const videoIdOf = (url) => url.match(/[?&]v=([\w-]{6,})/)?.[1] ?? null

// ---------------------------------------------------------------------------
// 1. collect every Wink-performed song with a PV link
// ---------------------------------------------------------------------------
const jobs = [] // {key, slug, url, videoId}
const byVideoId = new Map()

function addJob(key, titleForSlug, url) {
  const videoId = videoIdOf(url)
  if (!videoId) return
  if (!byVideoId.has(videoId)) {
    byVideoId.set(videoId, { key, slug: `${key}-${slugify(titleForSlug)}`, url, videoId })
  }
  jobs.push({ key, videoId })
}

for (const s of data.singles) {
  if (s.pvUrl) addJob(`single-${String(s.num).padStart(2, '0')}`, s.titleEn, s.pvUrl)
}
data.albums.forEach((a, i) => {
  const albumNum = String(i + 1).padStart(2, '0')
  for (const t of a.tracks) {
    // only Wink's own PVs; skip original-artist videos
    if (/official/i.test(t.notes) || t.video) {
      const url = t.video
      // album track Video fields are bare URLs (Wink PVs); original videos are under originalVideo
      if (url && !/Original/i.test(url)) addJob(`album-${albumNum}-track-${String(t.no ?? '').padStart(2, '0') || slugify(t.titleEn).slice(0, 8)}`, `${slugify(a.titleEn)}-${t.titleEn}`, url)
    }
  }
})

// ---------------------------------------------------------------------------
// 2. write TSV: slug <TAB> url  (one row per UNIQUE pv)
// ---------------------------------------------------------------------------
mkdirSync(path.join(ROOT, 'scripts'), { recursive: true })
const tsv = [...byVideoId.values()].map((j) => `${j.slug}\t${j.url}`).join('\n') + '\n'
writeFileSync(path.join(ROOT, 'scripts', 'sample-jobs.tsv'), tsv)

// key -> slug mapping consumed by fetch script when emitting samples.json
const keyToSlug = {}
for (const j of jobs) keyToSlug[j.key] = byVideoId.get(j.videoId).slug
writeFileSync(path.join(ROOT, 'scripts', 'sample-keys.json'), JSON.stringify(keyToSlug, null, 2) + '\n')

console.log(`Songs with PV: ${jobs.length}`)
console.log(`Unique videos to fetch: ${byVideoId.size}`)
console.log(`Wrote scripts/sample-jobs.tsv (${tsv.split('\n').filter(Boolean).length} rows)`)

// ---------------------------------------------------------------------------
// 3. download album covers into public/covers/<slug>.jpg
// ---------------------------------------------------------------------------
const COVER_DIR = path.join(ROOT, 'public', 'covers')
mkdirSync(COVER_DIR, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchCovers() {
  let ok = 0,
    skip = 0,
    fail = 0
  for (const [i, a] of data.albums.entries()) {
    const slug = `${String(i + 1).padStart(2, '0')}-${slugify(a.titleEn)}`
    const dest = path.join(COVER_DIR, `${slug}.jpg`)
    if (existsSync(dest)) {
      skip++
      continue
    }
    if (!a.coverUrl) {
      console.warn(`  no cover url: ${a.titleEn}`)
      fail++
      continue
    }
    try {
      await sleep(1500) // be polite to wikimedia; avoid 429s
      const res = await fetch(a.coverUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) wink-discography-app' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      writeFileSync(dest, buf)
      ok++
      console.log(`  cover ${slug}.jpg (${(buf.length / 1024).toFixed(0)} KB)`)
    } catch (e) {
      console.warn(`  FAIL ${a.titleEn}: ${e.message}`)
      fail++
    }
  }
  console.log(`Covers: ${ok} downloaded, ${skip} cached, ${fail} failed`)
}

await fetchCovers()
