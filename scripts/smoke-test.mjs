#!/usr/bin/env node
/**
 * Smoke-test the deck: load in headless Chromium, walk every slide from the
 * start, report console errors / broken images / per-slide-type counts.
 */
import puppeteer from 'puppeteer'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(`console: ${m.text()}`)
})
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().includes('favicon')) errors.push(`${r.status()}: ${r.url()}`)
})

await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 })
await new Promise((r) => setTimeout(r, 800))
await page.keyboard.press('Home') // start from slide 1
await new Promise((r) => setTimeout(r, 300))

const total = await page.evaluate(() =>
  Number([...document.querySelectorAll('div')].find((d) => /\d+ \/ \d+$/.test(d.textContent))?.textContent.match(/(\d+) \/ (\d+)/)?.[2] ?? 0),
)

let prevCounter = ''
const findings = { intro: 0, year: 0, single: 0, album: 0, finale: 0, playButtonsTotal: 0, pvLinksTotal: 0, albumTracksSeen: 0, brokenImages: [] }

for (let i = 0; i < total + 2 && i < 200; i++) {
  const info = await page.evaluate(() => {
    const active = document.querySelector('section[aria-hidden="false"]')
    if (!active) return null
    const text = active.textContent
    const type = active.querySelector('h1')?.textContent.includes('WINK') && !text.includes('A-SIDE')
      ? 'intro'
      : /^\d{4}$/.test(active.querySelector('h2')?.textContent.trim() ?? '') && !text.includes('TRACKLIST')
        ? 'year'
        : text.includes('THANK YOU, WINK')
          ? 'finale'
          : active.querySelector('ol')
            ? 'album'
            : text.includes('A-SIDE')
              ? 'single'
              : 'other'
    const imgs = [...active.querySelectorAll('img')]
    return {
      type,
      playButtons: active.querySelectorAll('button[aria-label^="play sample"]').length,
      pvLinks: active.querySelectorAll('a[href*="youtube.com"]').length,
      tracks: active.querySelectorAll('ol > li').length,
      broken: imgs.filter((im) => im.complete && im.naturalWidth === 0).map((im) => im.src),
      counter: [...document.querySelectorAll('div')].find((d) => /\d+ \/ \d+$/.test(d.textContent))?.textContent.trim(),
    }
  })
  if (!info) break
  const counter = info.counter
  if (i > 0 && counter === prevCounter) break // advance stopped moving
  prevCounter = counter

  if (findings[info.type] !== undefined) findings[info.type]++
  findings.playButtonsTotal += info.playButtons
  findings.pvLinksTotal += info.pvLinks
  if (info.type === 'album') findings.albumTracksSeen += info.tracks
  findings.brokenImages.push(...info.broken)

  await page.keyboard.press('ArrowRight')
  await new Promise((r) => setTimeout(r, 90))
}

console.log(`walked slides; counter ended at: ${prevCounter} (total ${total})`)
console.log(JSON.stringify(findings, null, 2))

if (errors.length) {
  console.log(`ERRORS (${errors.length}):`)
  for (const e of errors.slice(0, 10)) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('no console/page/network errors')
}

// sanity expectations
if (
  findings.intro !== 1 ||
  findings.finale !== 1 ||
  findings.single + 1 !== 26 || // single #26 renders on the finale epilogue
  findings.album !== 15 ||
  findings.year !== 8 // 1988..1995
) {
  console.log('UNEXPECTED SLIDE MIX (expect 1 intro, 8 year dividers 1988–1995, 25 singles + 1 in epilogue, 15 albums, 1 finale)')
}
await browser.close()
