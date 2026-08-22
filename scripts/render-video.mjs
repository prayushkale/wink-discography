#!/usr/bin/env node
/**
 * Render the deck to wink-presentation.mp4.
 *
 * 1. builds the app (vite build) and serves dist/ on a local port
 * 2. puppeteer walks every slide in ?render=1 mode and screenshots 1920x1080 PNGs
 * 3. timing plan: sampled slides last sample-length + hold; silent slides fixed secs
 * 4. ffmpeg: per-slide segment (still frame + padded audio), then concat
 *
 * Usage: node scripts/render-video.mjs [--max-slides N] [--out file.mp4]
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const argOf = (name, def) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : def
}
const MAX_SLIDES = Number(argOf('--max-slides', Infinity))
const OUT = path.resolve(ROOT, argOf('--out', 'wink-presentation.mp4'))
const PORT = 4517
const FPS = 30

const RENDER_DIR = path.join(ROOT, 'render')
const FRAMES_DIR = path.join(RENDER_DIR, 'frames')
const SEGS_DIR = path.join(RENDER_DIR, 'segs')
for (const d of [FRAMES_DIR, SEGS_DIR]) {
  rmSync(d, { recursive: true, force: true })
  mkdirSync(d, { recursive: true })
}

const run = (cmd, cmdArgs, opts = {}) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, cmdArgs, { stdio: opts.quiet ? 'ignore' : 'inherit', ...opts })
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))))
    p.on('error', reject)
  })

const probeDuration = (file) =>
  new Promise((resolve, reject) => {
    const p = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
    let out = ''
    p.stdout.on('data', (d) => (out += d))
    p.on('exit', () => resolve(Number(out.trim())))
    p.on('error', reject)
  })

// ---------------------------------------------------------------------------
// 1. serve the built app
// ---------------------------------------------------------------------------
console.log('building app...')
await run('npm', ['run', 'build'], { cwd: ROOT, quiet: true })
console.log('starting preview server...')
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' })
let up = false
for (let i = 0; i < 40 && !up; i++) {
  await sleep(250)
  try {
    await fetch(`http://localhost:${PORT}/`)
    up = true
  } catch {}
}
if (!up) {
  server.kill()
  throw new Error('preview server failed to start')
}
console.log('server up')

try {
  // ---------------------------------------------------------------------------
  // 2. screenshot every slide
  // ---------------------------------------------------------------------------
  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 })
  await page.goto(`http://localhost:${PORT}/?render=1`, { waitUntil: 'networkidle0', timeout: 60000 })
  await page.evaluate(() => document.fonts.ready)
  await sleep(1000)

  const meta = await page.evaluate(() => window.__deckSlides)
  if (!meta?.length) throw new Error('__deckSlides not exposed — render mode broken?')
  console.log(`${meta.length} slides discovered`)

  const plan = []
  for (let i = 0; i < Math.min(meta.length, MAX_SLIDES); i++) {
    if (i > 0) {
      await page.evaluate((n) => window.__deckAdvance(n), 1)
    }
    // deterministic settle: fonts/images already loaded by networkidle0 + fonts.ready
    await sleep(i === 0 ? 600 : 350)
    const frame = path.join(FRAMES_DIR, `${String(i).padStart(3, '0')}.png`)
    await page.screenshot({ path: frame })
    const m = meta[i]
    let duration = m.type === 'intro' || m.type === 'finale' ? 8 : m.type === 'year' ? 4 : 5
    if (m.sampleSrc) {
      const audioFile = path.join(ROOT, 'public', m.sampleSrc.replace(/^\//, ''))
      const dur = existsSync(audioFile) ? await probeDuration(audioFile) : 0
      if (dur > 0) duration = Math.round((dur + 2) * 10) / 10
      else m.sampleSrc = null
    }
    plan.push({ index: i, type: m.type, label: m.label, frame, sampleSrc: m.sampleSrc ?? null, duration })
    process.stdout.write(`\r  frame ${i + 1}/${meta.length}`)
  }
  console.log()
  await browser.close()

  // ---------------------------------------------------------------------------
  // 3+4. encode segments & concat
  // ---------------------------------------------------------------------------
  const listFile = path.join(SEGS_DIR, 'list.txt')
  const listLines = []
  for (const seg of plan) {
    const outFile = path.join(SEGS_DIR, `seg_${String(seg.index).padStart(3, '0')}.mp4`)
    const ffArgs = [
      '-y',
      '-loop',
      '1',
      '-framerate',
      String(FPS),
      '-t',
      String(seg.duration),
      '-i',
      seg.frame,
    ]
    let audioMap = 'an'
    if (seg.sampleSrc) {
      ffArgs.push('-i', path.join(ROOT, 'public', seg.sampleSrc.replace(/^\//, '')))
      audioMap = '1:a'
    }
    ffArgs.push(
      '-f',
      'lavfi',
      '-t',
      String(seg.duration),
      '-i',
      'anullsrc=r=44100:cl=stereo',
      '-filter_complex',
      seg.sampleSrc
        ? `[1:a]apad=whole_dur=${seg.duration},volume=1.0[a]`
        : '[2:a]anull[a]',
      '-map',
      '0:v',
      '-map',
      '[a]',
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-r',
      String(FPS),
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-ar',
      '44100',
      '-ac',
      '2',
      '-shortest',
      outFile,
    )
    process.stdout.write(`\r  encoding ${seg.index + 1}/${plan.length} (${seg.type}: ${seg.label})`)
    await run('ffmpeg', ffArgs, { quiet: true })
    listLines.push(`file '${outFile}'`)
  }
  console.log()
  writeFileSync(listFile, listLines.join('\n') + '\n')

  console.log('concatenating...')
  await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-movflags', '+faststart', OUT], {
    quiet: true,
  })

  const totalDur = plan.reduce((n, s) => n + s.duration, 0)
  console.log(`\ndone: ${OUT}`)
  console.log(`slides: ${plan.length} · runtime: ${Math.floor(totalDur / 60)}m ${Math.round(totalDur % 60)}s`)
} finally {
  server.kill()
}
