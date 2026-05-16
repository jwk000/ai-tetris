#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p public/audio

dl() {
  local url="$1"; local out="public/audio/$2"
  if [ -s "$out" ]; then
    echo "skip $out (already exists)"
    return
  fi
  curl -sSL -A "Mozilla/5.0" "$url" -o "$out"
  echo "got  $out ($(wc -c < "$out") bytes)"
}

dl "https://assets.mixkit.co/active_storage/sfx/2627/2627-preview.mp3" "move.mp3"
dl "https://assets.mixkit.co/active_storage/sfx/2626/2626-preview.mp3" "rotate.mp3"
dl "https://assets.mixkit.co/active_storage/sfx/2628/2628-preview.mp3" "drop.mp3"
dl "https://assets.mixkit.co/active_storage/sfx/2633/2633-preview.mp3" "line-clear.mp3"
dl "https://assets.mixkit.co/active_storage/sfx/1300/1300-preview.mp3"   "thunder.mp3"
dl "https://assets.mixkit.co/active_storage/sfx/2393/2393-preview.mp3" "rain-loop.mp3"
dl "https://opengameart.org/sites/default/files/013_Another_August.mp3"    "bgm.mp3"

echo ""
echo "audio assets ready in public/audio/"
