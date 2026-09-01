#!/usr/bin/env bash
# ============================================================
#  PortPilot - Per-platform release build script
# ============================================================
#
#  Downloads the matching WITR binary for every supported
#  (platform, arch) pair and packages one VSIX per target.
#  The Marketplace serves only the matching artifact on install.
#
#  Requirements:
#    - Node 18+
#    - unzip on PATH (for Windows .zip assets)
#    - vsce (`npm i -g @vscode/vsce`)
#
#  Usage:
#    ./PUBLISH.sh                       # build all 6 VSIX
#    ./PUBLISH.sh --publish <token>     # build + vsce publish each
#    ./PUBLISH.sh --target linux-x64    # build only one target
# ============================================================

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

PUBLISH_TOKEN=""
ONLY_TARGET=""

for arg in "$@"; do
  case "$arg" in
    --publish)   PUBLISH_TOKEN="${2:-}"; shift 2 ;;
    --publish=*) PUBLISH_TOKEN="${arg#*=}"; shift ;;
    --target)    ONLY_TARGET="${2:-}"; shift 2 ;;
    --target=*)  ONLY_TARGET="${arg#*=}"; shift ;;
    *) echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

TARGETS=(
  "linux-x64"
  "linux-arm64"
  "darwin-x64"
  "darwin-arm64"
  "win32-x64"
  "win32-arm64"
)

declare -A TARGET_TO_PLATFORM=(
  [linux-x64]="linux:x64"
  [linux-arm64]="linux:arm64"
  [darwin-x64]="darwin:x64"
  [darwin-arm64]="darwin:arm64"
  [win32-x64]="win32:x64"
  [win32-arm64]="win32:arm64"
)

if [[ -n "$ONLY_TARGET" ]]; then
  TARGETS=("$ONLY_TARGET")
fi

echo "==> Downloading WITR binaries..."
node scripts/download-witr.js

ARTIFACTS=()
for target in "${TARGETS[@]}"; do
  p="${TARGET_TO_PLATFORM[$target]}"
  if [[ -z "$p" ]]; then
    echo "✗ Unknown target: $target"
    exit 1
  fi
  platform="${p%:*}"
  arch="${p#*:}"
  echo ""
  echo "==> Building $target ..."
  node scripts/build-platform.js --platform "$platform" --arch "$arch"
  vsix="portpilot-$(node -p "require('./package.json').version")-$target.vsix"
  if [[ -f "$vsix" ]]; then
    ARTIFACTS+=("$vsix")
  else
    echo "✗ Expected artifact not found: $vsix"
    exit 1
  fi
done

echo ""
echo "==> Built ${#ARTIFACTS[@]} VSIX:"
for a in "${ARTIFACTS[@]}"; do echo "    $a"; done

if [[ -n "$PUBLISH_TOKEN" ]]; then
  echo ""
  echo "==> Publishing with token..."
  for a in "${ARTIFACTS[@]}"; do
    echo "    → $a"
    npx vsce publish -p "$PUBLISH_TOKEN" --packagePath "$a"
  done
  echo ""
  echo "✓ Published ${#ARTIFACTS[@]} artifacts"
fi
