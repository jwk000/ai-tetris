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

dl "https://assets.mixkit.co/active_storage/sfx/1133/1133-preview.mp3" "move.mp3"
dl "https://assets.mixkit.co/active_storage/sfx/1489/1489-preview.mp3" "rotate.mp3"
# drop.wav 由用户手动提供，不在自动下载范围内
dl "https://assets.mixkit.co/active_storage/sfx/2782/2782-preview.mp3" "line-clear.mp3"
dl "https://assets.mixkit.co/active_storage/sfx/2997/2997-preview.mp3" "water-drop.mp3"
dl "https://assets.mixkit.co/active_storage/sfx/210/210-preview.mp3"   "thunder.mp3"
dl "https://assets.mixkit.co/active_storage/sfx/2393/2393-preview.mp3" "rain-loop.mp3"
dl "https://opengameart.org/sites/default/files/benkyou-loop_0.mp3"    "bgm.mp3"

echo ""
echo "audio assets ready in public/audio/"
