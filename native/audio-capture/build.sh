#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$SCRIPT_DIR/../../build/native"
mkdir -p "$OUT_DIR"

build_windows_msvc() {
  echo "Building Windows audio-capture binary (MSVC)..."
  cl.exe /EHsc /O2 /Fe:"$OUT_DIR/audio-capture.exe" \
    "$SCRIPT_DIR/windows/main.cpp" \
    ole32.lib
  echo "Built: $OUT_DIR/audio-capture.exe"
}

build_macos() {
  echo "Building macOS audio-capture binary..."
  swiftc -O -o "$OUT_DIR/audio-capture" \
    "$SCRIPT_DIR/macos/main.swift" \
    -framework ScreenCaptureKit \
    -framework CoreMedia \
    -framework AVFoundation
  echo "Built: $OUT_DIR/audio-capture"
}

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*|Windows_NT)
    build_windows_msvc
    ;;
  Darwin)
    build_macos
    ;;
  Linux)
    echo "No native audio capture binary for Linux."
    echo "Windows audio-capture.exe is built on Windows via native/audio-capture/windows/build.bat"
    ;;
  *)
    echo "No native audio capture binary for this platform ($(uname -s)). Skipping."
    ;;
esac
