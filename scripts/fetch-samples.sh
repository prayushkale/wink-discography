#!/usr/bin/env bash
# Fetch each PV's audio via yt-dlp, trim to a ~12s "main part" sample with
# the heuristic START = max(30s, duration * 0.35) — no audio analysis.
# Emits src/data/samples.json mapping song-key -> {src, duration, slug}
#
# Usage: npm run fetch:samples [-- [slug ...]]   (optional filter by slug prefix)
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JOBS="$ROOT/scripts/sample-jobs.tsv"
KEYS="$ROOT/scripts/sample-keys.json"
RAW_DIR="$ROOT/.cache/audio"           # full downloads (gitignored)
OUT_DIR="$ROOT/public/samples"         # trimmed clips served by the app
FAILED="$ROOT/scripts/failed.txt"
SAMPLE_LEN=12
mkdir -p "$RAW_DIR" "$OUT_DIR"

FILTER="${1:-}"
> "$FAILED"

command -v yt-dlp >/dev/null || { echo "yt-dlp not installed (brew install yt-dlp)"; exit 1; }
command -v ffmpeg  >/dev/null || { echo "ffmpeg not installed"; exit 1; }

ok=0; skip=0; fail=0
while IFS=$'\t' read -r slug url; do
  [[ -z "$slug" ]] && continue
  if [[ -n "$FILTER" && "$slug" != "$FILTER"* ]]; then continue; fi

  mp3="$OUT_DIR/$slug.mp3"
  if [[ -f "$mp3" ]]; then skip=$((skip+1)); continue; fi
  raw="$RAW_DIR/$slug.m4a"

  # 1) download once per unique video
  if [[ ! -f "$raw" ]]; then
    echo ">> fetching $slug"
    if ! yt-dlp -x --audio-format m4a --audio-quality 0 \
         -o "$RAW_DIR/%(id)s.m4a" --no-playlist --quiet --no-warnings "$url"; then
      echo -e "$slug\t$url" >> "$FAILED"
      echo "   FAILED download: $slug"
      fail=$((fail+1)); continue
    fi
    # yt-dlp names output by video id; resolve it back to our slug
    vid="$(echo "$url" | grep -oE 'v=[A-Za-z0-9_-]+' | cut -d= -f2)"
    if [[ -f "$RAW_DIR/$vid.m4a" ]]; then mv "$RAW_DIR/$vid.m4a" "$raw"; fi
  fi
  [[ ! -f "$raw" ]] && { echo -e "$slug\t$url" >> "$FAILED"; fail=$((fail+1)); continue; }

  # 2) heuristic trim -> main-part sample with fades + loudness normalization
  dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$raw")"
  start="$(python3 -c "print(max(30, round($dur * 0.35)))")"
  end_limit="$(python3 -c "print(max(0, $dur - $start))")"
  take="$(python3 -c "print(min($SAMPLE_LEN, $end_limit))")"
  if (( $(python3 -c "print(1 if $take < 5 else 0)") )); then
    # track too short for the offset heuristic; fall back to first seconds
    start=0; take="$dur"
  fi
  ffmpeg -y -v error -ss "$start" -t "$take" -i "$raw" \
    -af "afade=t=in:d=0.7,afade=t=out:st=$(python3 -c "print(max(0,$take-1))"):d=1,loudnorm" \
    -b:a 160k "$mp3" || { echo -e "$slug\t$url" >> "$FAILED"; fail=$((fail+1)); continue; }
  ok=$((ok+1))
  echo "   ok $slug ($take s @ ${start}s)"
done < "$JOBS"

# 3) emit samples.json for every successfully produced clip
node - "$ROOT" <<'EOF'
const { readFileSync, writeFileSync, existsSync, readdirSync } = require('node:fs')
const path = require('node:path')
const root = process.argv[2]
const keys = JSON.parse(readFileSync(path.join(root, 'scripts/sample-keys.json'), 'utf8'))
const out = {}
for (const [key, slug] of Object.entries(keys)) {
  const file = path.join(root, 'public/samples', `${slug}.mp3`)
  if (!existsSync(file)) continue
  out[key] = { slug, src: `/samples/${slug}.mp3` }
}
writeFileSync(path.join(root, 'src/data/samples.json'), JSON.stringify(out, null, 2) + '\n')
console.log(`samples.json: ${Object.keys(out).length} entries`)
EOF

echo "----"
echo "done: $ok fetched, $skip cached, $fail failed"
[[ $fail -gt 0 ]] && echo "see $FAILED" || true
