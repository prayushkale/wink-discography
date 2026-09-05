#!/usr/bin/env node
/**
 * Smoke test for the tab-audio capture pipeline used by record-presentation.mjs.
 *
 * Opens headed Chrome (position configurable), plays a 440Hz WebAudio tone for
 * 6s, captures tab audio via getDisplayMedia (auto-selected), records it to
 * render/smoke-capture.webm, then ffprobe-checks duration + loudness.
 *
 * Iterates over capture auto-select flag combos until one works.
 *
 * Usage: SMOKE_WIN_POS="0,0" node scripts/smoke-capture.mjs
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'render', 'smoke-capture.webm')
mkdirSync(path.join(ROOT, 'render'), { recursive: true })
rmSync(OUT, { force: true })

const TAB_TITLE = 'SMOKE-CAPTURE-TONE'
const WIN_POS = process.env.SMOKE_WIN_POS || '0,0'

const server = spawn('npx', ['vite', 'preview', '--port', '4519', '--strictPort'], { cwd: ROOT, stdio: 'ignore' })
await sleep(1500)

const FLAG_SETS = [
  [`--auto-select-tab-capture-source-by-title=${TAB_TITLE}`],
  [`--auto-select-desktop-capture-source=${TAB_TITLE}`],
  ['--auto-select-desktop-capture-source=Entire screen'],
]

let saved = false
outer: for (const flagSet of FLAG_SETS) {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: process.env.SMOKE_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: [
      `--window-position=${WIN_POS}`,
      '--window-size=1280,800',
      '--no-first-run',
      '--no-default-browser-check',
      '--use-fake-ui-for-media-stream',
      ...flagSet,
      '--autoplay-policy=no-user-gesture-required',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
    ],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800 })
    await page.goto('http://localhost:4519/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.evaluate((t) => (document.title = t), TAB_TITLE)

    const result = await page.evaluate(async (title) => {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      gain.gain.value = 0.25
      osc.frequency.value = 440
      osc.connect(gain).connect(ctx.destination)
      osc.start()

      let stream = null
      let lastErr = null
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, preferCurrentTab: true })
      } catch (e) {
        lastErr = e
      }
      if (!stream?.getAudioTracks().length) {
        try {
          stream?.getTracks().forEach((t) => t.stop())
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        } catch (e) {
          lastErr = e
        }
      }
      const aTracks = stream ? stream.getAudioTracks() : []
      if (!stream || !aTracks.length) {
        stream?.getTracks().forEach((t) => t.stop())
        osc.stop()
        await ctx.close()
        return { ok: false, error: lastErr?.message ?? 'no audio track' }
      }
      stream.getVideoTracks().forEach((t) => t.stop())
      const audioOnly = new MediaStream(aTracks)

      const rec = new MediaRecorder(audioOnly, { mimeType: 'audio/webm;codecs=opus' })
      const chunks = []
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      rec.start(250)
      await new Promise((r) => setTimeout(r, 6000))
      rec.stop()
      osc.stop()
      await ctx.close()
      await new Promise((r) => setTimeout(r, 500))
      const blob = new Blob(chunks, { type: 'audio/webm' })
      window.__smokeAudio = blob
      return { ok: true, bytes: blob.size, label: stream.getAudioTracks()[0].label }
    }, TAB_TITLE)

    if (!result.ok) {
      console.error(`[${flagSet[0]}] FAIL: ${result.error}`)
      continue
    }
    const dataUrl = await page.evaluate(async () => {
      const buf = await window.__smokeAudio.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let bin = ''
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      return 'data:audio/webm;base64,' + btoa(bin)
    })
    writeFileSync(OUT, Buffer.from(dataUrl.split(',')[1], 'base64'))
    console.log(`[${flagSet[0]}] OK: ${result.bytes} bytes, track: "${result.label}"`)
    saved = true
    break outer
  } finally {
    await browser.close()
  }
}
server.kill()

if (!saved) {
  console.error('ALL FLAG SETS FAILED')
  process.exit(1)
}

const probe = spawn('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1', OUT])
let out = ''
probe.stdout.on('data', (d) => (out += d))
await new Promise((r) => probe.on('exit', r))
console.log(out)
const vol = spawn('ffmpeg', ['-i', OUT, '-af', 'volumedetect', '-f', 'null', '-'])
let vout = ''
vol.stderr.on('data', (d) => (vout += d))
await new Promise((r) => vol.on('exit', r))
console.log(vout.match(/mean_volume: .+/)?.[0], '|', vout.match(/max_volume: .+/)?.[0])
