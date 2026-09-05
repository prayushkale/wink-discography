#!/usr/bin/env node
/** Diagnose getDisplayMedia/getUserMedia behavior in this Chrome. */
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import puppeteer from 'puppeteer'

const server = spawn('npx', ['vite', 'preview', '--port', '4519', '--strictPort'], { cwd: process.cwd(), stdio: 'ignore' })
await sleep(1500)

const browser = await puppeteer.launch({
  headless: false,
  executablePath: process.env.SMOKE_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: [
    `--window-position=${process.env.SMOKE_WIN_POS || '0,0'}`,
    '--window-size=1280,800',
    '--no-first-run',
    '--no-default-browser-check',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
  ],
})

try {
  const page = await browser.newPage()
  await page.goto('http://localhost:4519/', { waitUntil: 'domcontentloaded' })
  const diag = await page.evaluate(async () => {
    const out = { ua: navigator.userAgent, secure: isSecureContext, md: !!navigator.mediaDevices }
    const tryIt = async (label, fn) => {
      try {
        const s = await fn()
        out[label] = `OK tracks=${s.getTracks().map((t) => t.kind + ':' + t.label.slice(0, 60)).join(', ')}`
        s.getTracks().forEach((t) => t.stop())
      } catch (e) {
        out[label] = `ERR ${e.name}: ${e.message}`
      }
    }
    await tryIt('gum-audio-fake', () => navigator.mediaDevices.getUserMedia({ audio: true }))
    await tryIt('gdm-audio-only', () => navigator.mediaDevices.getDisplayMedia({ video: false, audio: true }))
    await tryIt('gdm-prefer-tab', () => navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, preferCurrentTab: true }))
    await tryIt('gdm-video-only', () => navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }))
    return out
  })
  console.log(JSON.stringify(diag, null, 2))
} finally {
  await browser.close()
  server.kill()
}
