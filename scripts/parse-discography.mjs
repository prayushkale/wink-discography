#!/usr/bin/env node
/**
 * Parse wink-discography.md into src/data/discography.json
 *
 * Structure of the markdown:
 *   "## About Wink"            -> bullet list of group facts
 *   "### Singles YYYY–YYYY"    -> "#### N. Title (date)" blocks containing "##### track" blocks
 *   "### Studio Albums YYYY–YYYY" -> "#### Title — Japanese (date)" blocks with ##### tracks
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MD_PATH = path.join(ROOT, 'wink-discography.md')
const OUT_DIR = path.join(ROOT, 'src', 'data')

const md = readFileSync(MD_PATH, 'utf8')
const lines = md.split('\n')

/** split lines into sections at a heading level+pattern */
function sectionize(startIdx, endIdx, levelRe) {
  const sections = []
  let current = null
  for (let i = startIdx; i < endIdx; i++) {
    const line = lines[i]
    const m = line.match(levelRe)
    if (m) {
      if (current) sections.push(current)
      current = { title: line, start: i + 1 }
    } else if (current) {
      current.end = i + 1 // end is exclusive
    }
  }
  if (current) sections.push(current)
  return sections.map((s) => ({ ...s, end: s.end ?? endIdx }))
}

function findHeading(re) {
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) return i
  }
  return -1
}

// ---------------------------------------------------------------------------
// Group info ("## About Wink")
// ---------------------------------------------------------------------------
function parseGroup() {
  const start = findHeading(/^## About Wink$/)
  const singlesStart = findHeading(/^## Singles$/)
  const facts = []
  for (let i = start + 1; i < singlesStart; i++) {
    const m = lines[i].match(/^- \*\*(.+?)\*\*: (.*)$/)
    if (m) facts.push([m[1], m[2]])
  }
  const get = (key) => facts.find(([k]) => k.toLowerCase().startsWith(key.toLowerCase()))?.[1] ?? ''
  return {
    name: 'Wink',
    nameJp: 'ウィンク',
    tagline: md.match(/^(\*[^*]+\*)$/m)?.[1]?.replaceAll('*', '') ?? '',
    members: [
      { nameEn: 'Suzuki Sachiko', nameJp: '鈴木早智子', born: '1969-02-22' },
      { nameEn: 'Aida Shoko', nameJp: '相田翔子', born: '1970-02-23' },
    ],
    active: get('Active'),
    label: get('Label'),
    producer: get('Producer'),
    choreography: get('Choreography'),
    style: get('Style'),
    awards: get('Awards'),
    chartLegacy: get('Chart legacy'),
    reunions: get('Reunions'),
    note: get('Note'),
  }
}

// ---------------------------------------------------------------------------
// Helpers shared by single/album parsing
// ---------------------------------------------------------------------------
function parseInlineField(text) {
  // "- **Credits**: ..." style value already captured; here we clean markdown links
  return text.trim()
}

function extractLinks(text) {
  const links = []
  const re = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g
  let m
  while ((m = re.exec(text))) links.push({ label: m[1], url: m[2] })
  // bare urls on their own bullet
  const bareRe = /(?<!\]\()https?:\/\/[^\s)]+/g
  for (const url of text.match(bareRe) ?? []) {
    if (!links.some((l) => l.url === url)) links.push({ label: null, url })
  }
  return links
}

function firstUrl(links) {
  return links[0]?.url ?? null
}

function parseTrackBlock(blockLines) {
  const track = {
    no: null,
    titleEn: '',
    titleJp: '',
    type: '',
    release: '',
    credits: '',
    original: '',
    chart: '',
    video: null,
    originalVideo: null,
    notes: '',
  }
  // heading: "##### 1. Nagisa Monogatari — 渚物語" or "##### Sugar Baby Love"
  const headMatch = blockLines[0].match(/^#####\s+(?:(\d+)\.\s+)?(.+?)(?:\s+—\s+(.*))?$/)
  if (headMatch) {
    track.no = headMatch[1] ? Number(headMatch[1]) : null
    track.titleEn = headMatch[2].trim()
    if (headMatch[3]) track.titleJp = headMatch[3].trim()
  }
  let soloMember = null
  const soloInTitle = blockLines[0].match(/\((Suzuki Sachiko|Aida Shoko)( solo)?\)/)
  if (soloInTitle) soloMember = soloInTitle[1]

  for (const line of blockLines.slice(1)) {
    const fm = line.match(/^- \*\*(.+?)\*\*: (.*)$/)
    if (!fm) continue
    const [, key, rawVal] = fm
    const val = parseInlineField(rawVal)
    switch (key) {
      case 'Type':
        track.type = val.replace(/— parent single:.*/i, '').replace(/— parent release:.*/i, '').trim()
        break
      case 'Release':
        track.release = val
        break
      case 'Credits':
        track.credits = val
        break
      case 'Original': {
        const cleaned = val.replace(/https?:\/\/\S+/g, '').replace(/—\s*$/, '').trim()
        // placeholders like "— (original song)" mean no original
        track.original = /^—|^\(original song\)/.test(cleaned) || cleaned === '' ? '' : cleaned
        break
      }
      case 'Chart':
        track.chart = val
        break
      case 'Video': {
        const links = extractLinks(val)
        const pv = links.find((l) => /wink/i.test(l.label ?? '')) ?? links.find((l) => !l.label || /official/i.test(l.label ?? ''))
        const orig = links.find((l) => l !== pv)
        track.video = pv?.url ?? firstUrl(links)
        track.originalVideo = orig?.url ?? null
        break
      }
      case 'Notes':
        track.notes = val
        break
    }
  }
  track.soloMember = soloMember
  return track
}

function parseBulletFields(blockLines) {
  const fields = {}
  for (const line of blockLines) {
    const m = line.match(/^- \*\*(.+?)\*\*(?: \((.+?)\))?: (.*)$/)
    if (m) fields[m[1]] = { qualifier: m[2] ?? null, value: parseInlineField(m[3]) }
  }
  return fields
}

function extractCoverUrl(blockLines) {
  const joined = blockLines.join('\n')
  const m = joined.match(/!\[cover\]\((https?:\/\/[^)]+)\)/)
  return m?.[1] ?? null
}

// ---------------------------------------------------------------------------
// Singles
// ---------------------------------------------------------------------------
function parseSingles() {
  const out = []
  const singlesTable = parseSinglesTable()
  // All "### Singles YYYY–YYYY" subsections between "## Singles" and the next "## "
  const h2Start = findHeading(/^## Singles$/)
  const h2End = findHeading(/^## Studio Albums$/)
  const subs = sectionize(h2Start + 1, h2End, /^### Singles .+$/)

  for (const sub of subs) {
    // within a sub-section, split into "#### N." blocks
    const blocks = []
    let cur = null
    for (let i = sub.start; i < sub.end; i++) {
      if (/^#### \d+\./.test(lines[i])) {
        if (cur) blocks.push(cur)
        cur = [lines[i]]
      } else if (cur) {
        cur.push(lines[i])
      }
    }
    if (cur) blocks.push(cur)

    for (const blockLines of blocks) {
      // "#### 5. Samishii Nettaigyo — 淋しい熱帯魚 (1989-07-05)"
      const head = blockLines[0]
      const hm = head.match(/^#### (\d+)\.\s+(.+?)(?:\s+—\s+(.+?))?\s+\((\d{4}-\d{2}-\d{2})\)\s*$/)
      if (!hm) {
        console.warn(`!! unparsed single heading: ${head}`)
        continue
      }
      const [, numStr, titleEn, titleJp, date] = hm

      // split tracks at "#####"
      const trackBlocks = []
      let curT = null
      for (let i = 1; i < blockLines.length; i++) {
        if (/^##### /.test(lines[blockLines[i]] ?? '') || /^##### /.test(blockLines[i])) {
          if (curT) trackBlocks.push(curT)
          curT = [blockLines[i]]
        } else if (curT) {
          curT.push(blockLines[i])
        }
      }
      if (curT) trackBlocks.push(curT)
      // NOTE: iterate over block content lines properly
      const tracks = trackBlocks.map(parseTrackBlock).map((t, idx) => ({ role: idx === 0 ? 'A' : 'B', ...t }))

      const fields = parseBulletFields(blockLines.filter((l) => /^- \*\*/.test(l)))
      const chartVal = fields['Chart']?.value ?? ''
      const table = singlesTable[Number(numStr)] ?? {}

      // PV link from A-side track's Video field (or bare URL in Notes)
      const pvFromTracks = tracks.find((t) => t.video)?.video ?? null

      out.push({
        num: Number(numStr),
        titleEn,
        titleJp: titleJp ?? '',
        releaseDate: date,
        peak: (chartVal.match(/peak #(\d+)/i)?.[1] ? `#${chartVal.match(/peak #(\d+)/i)[1]}` : null) ?? table.peak ?? null,
        sales: chartVal.match(/sales:\s*([\d,]+(?:\+)?)/i)?.[1] ?? table.sales ?? null,
        riaj: table.riaj ?? null,
        tracks,
        pvUrl: pvFromTracks,
      })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Studio Albums
// ---------------------------------------------------------------------------
function parseAlbums() {
  const out = []
  const h2Start = findHeading(/^## Studio Albums$/)
  const h2End = findHeading(/^## Other Releases$/)
  const tableRows = []
  // summary table right after the h2
  for (let i = h2Start + 1; i < Math.min(h2Start + 30, h2End); i++) {
    const m = lines[i].match(/^\| (\d{4}) \| (.+?) \| (.+?) \| (\d{4}-\d{2}-\d{2})(\*)? \| (#\d+) \| ([\d,]+) \| (—|\w+) \|$/)
    if (m) tableRows.push(m)
  }

  const subs = sectionize(h2Start + 1, h2End, /^### Studio Albums .+$/)
  for (const sub of subs) {
    const blocks = []
    let cur = null
    for (let i = sub.start; i < sub.end; i++) {
      if (/^#### /.test(lines[i])) {
        if (cur) blocks.push(cur)
        cur = [lines[i]]
      } else if (cur) {
        cur.push(lines[i])
      }
    }
    if (cur) blocks.push(cur)

    for (const blockLines of blocks) {
      const head = blockLines[0]
      // "#### Moonlight Serenade — ムーンライト・セレナーデ (1988-07-01)"
      const hm = head.match(/^#### (.+?)(?:\s+—\s+(.+?))?\s+\((\d{4}-\d{2}-\d{2})\)\s*$/)
      if (!hm) {
        console.warn(`!! unparsed album heading: ${head}`)
        continue
      }
      const [, titleEn, titleJp, released] = hm
      const year = Number(released.slice(0, 4))
      const fields = parseBulletFields(blockLines)
      const chartLine = blockLines.find((l) => l.startsWith('- **Chart**')) ?? ''
      const peak = chartLine.match(/peak #(\d+)/i)?.[1] ?? tableRows.find((r) => r[2] === titleEn)?.[6]?.replace('#', '') ?? null
      const sales = chartLine.match(/sales:\s*([\d,]+)\s*\|/i)?.[1] ?? tableRows.find((r) => r[2] === titleEn)?.[7] ?? null
      const certM = chartLine.match(/certification: (.+)$/i)?.[1] ?? tableRows.find((r) => r[2] === titleEn)?.[8] ?? '—'

      // tracks are ##### numbered blocks
      const trackBlocks = []
      let curT = null
      for (let i = 1; i < blockLines.length; i++) {
        if (/^##### /.test(blockLines[i])) {
          if (curT) trackBlocks.push(curT)
          curT = [blockLines[i]]
        } else if (curT) {
          curT.push(blockLines[i])
        }
      }
      if (curT) trackBlocks.push(curT)
      const tracks = trackBlocks.map(parseTrackBlock)

      out.push({
        year,
        titleEn,
        titleJp: titleJp ?? '',
        released,
        peak: peak ? `#${peak}` : null,
        sales,
        riaj: certM && certM !== '—' ? certM.trim().replace(/\(RIAJ\)/i, '').trim() : null,
        coverUrl: extractCoverUrl(blockLines),
        notes: fields['Notes']?.value ?? '',
        tracks,
      })
    }
  }

  // fill missing RIAJ from summary-table row match fallback already handled
  return out.sort((a, b) => a.released.localeCompare(b.released))
}

// ---------------------------------------------------------------------------
// Summary tables + video link index (fallbacks / cross-checks)
// ---------------------------------------------------------------------------
function parseSinglesTable() {
  // rows like: | 5 | Samishii Nettaigyo | 淋しい熱帯魚 | 1989-07-05* | #1 | 564,000 | Platinum | Twin Memories |
  const start = findHeading(/^## Singles$/)
  const end = findHeading(/^### Singles/)
  const byNum = {}
  for (let i = start; i < end; i++) {
    if (!/^\|/.test(lines[i]) || /^\|\s*-/.test(lines[i])) continue
    const cells = lines[i].split('|').map((c) => c.trim())
    // ['', '5', 'Sugar Baby Love', '—', '1988-04-27', '#20', '61,000', '—', 'Moonlight Serenade', '']
    if (cells.length < 9 || !/^\d+$/.test(cells[1]) || !/^\d{4}-\d{2}-\d{2}/.test(cells[4])) continue
    const [peak, sales, riaj] = [cells[5], cells[6], cells[7]]
    byNum[Number(cells[1])] = {
      peak: peak && peak !== '—' ? `#${peak.replace('#', '')}` : null,
      sales: sales && sales !== '—' ? sales : null,
      riaj: riaj && riaj !== '—' ? riaj : null,
    }
  }
  return byNum
}

function parseVideoLinkIndex() {
  const start = findHeading(/^## Video Links Index$/)
  const end = findHeading(/^## Sources & Notes$/)
  const entries = []
  let lastTitle = null
  for (let i = start; i < end; i++) {
    const line = lines[i]
    if (/^\|/.test(line) && !/^\|\s*-/.test(line)) {
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean)
      if (/youtube\.com|youtu\.be/.test(line) && cells.length >= 2 && !/^Song$|^Original$|^Video$/.test(cells[0])) {
        const titleCell = lastTitle && !cells[0].match(/https?:\/\//) ? cells[0] : cells[0]
        const url = line.match(/(https?:\/\/(?:www\.|m\.)?youtube\.com\/watch\?[^|\s]+)/)?.[1]
        if (url) entries.push({ label: titleCell, url })
        lastTitle = titleCell
      } else {
        lastTitle = cells[0] ?? null
      }
    }
  }
  return entries
}

function countVideoLinks() {
  const idxStart = findHeading(/^## Video Links Index$/)
  const srcStart = findHeading(/^## Sources & Notes$/)
  let count = 0
  for (let i = idxStart; i < srcStart; i++) {
    if (/https?:\/\//.test(lines[i])) count++
  }
  return count
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
mkdirSync(OUT_DIR, { recursive: true })
const singlesTable = parseSinglesTable()
const videoIndex = parseVideoLinkIndex()
const data = {
  generatedAt: new Date().toISOString(),
  group: parseGroup(),
  singles: parseSingles(),
  albums: parseAlbums(),
}
// fallback: fill missing PVs from the Video Links Index by fuzzy title match
for (const s of data.singles) {
  if (s.pvUrl) continue
  const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '')
  const hit = videoIndex.find((v) => {
    const vNorm = norm(v.label)
    const base = norm(s.titleEn.split('〜')[0].split('[')[0])
    return vNorm.includes(norm(s.titleEn)) || base.includes(vNorm) || vNorm.startsWith(base.slice(0, 10))
  })
  if (hit) s.pvUrl = hit.url
}
const videoLinkCount = videoIndex.length

console.log(`Group info: ${data.group.active}`)
console.log(`Singles parsed: ${data.singles.length} (expect 26)`)
console.log(`Albums parsed: ${data.albums.length} (expect 15)`)
console.log(`Album tracks total: ${data.albums.reduce((n, a) => n + a.tracks.length, 0)}`)
console.log(`Singles with PV link: ${data.singles.filter((s) => s.pvUrl).length}`)
console.log(`Video Links Index entries: ~${videoLinkCount}`)

if (data.singles.length !== 26) {
  console.error('FAIL: expected 26 singles')
  process.exitCode = 1
}
if (data.albums.length !== 15) {
  console.error('FAIL: expected 15 studio albums')
  process.exitCode = 1
}

writeFileSync(path.join(OUT_DIR, 'discography.json'), JSON.stringify(data, null, 2) + '\n')
console.log(`Wrote ${path.relative(ROOT, path.join(OUT_DIR, 'discography.json'))}`)
