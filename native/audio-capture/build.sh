#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$SCRIPT_DIR/../../build/native"
mkdir -p "$OUT_DIR"

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*|Windows_NT)
    echo "Building Windows audio-capture binary..."
    cl.exe /EHsc /O2 /Fe:"$OUT_DIR/audio-capture.exe" \
      "$SCRIPT_DIR/windows/main.cpp" \
      ole32.lib
    echo "Built: $OUT_DIR/audio-capture.exe"
    ;;
  Darwin)
    echo "Building macOS audio-capture binary..."
    swiftc -O -o "$OUT_DIR/audio-capture" \
      "$SCRIPT_DIR/macos/main.swift" \
      -framework ScreenCaptureKit \
      -framework CoreMedia \
      -framework AVFoundation
    echo "Built: $OUT_DIR/audio-capture"
    ;;
  *)
    echo "No native audio capture binary for this platform ($(uname -s)). Skipping."
    ;;
esac
