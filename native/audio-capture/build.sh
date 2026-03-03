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

build_screen_capture_windows_msvc() {
  echo "Building Windows screen-capture binary (MSVC)..."
  cl.exe /EHsc /O2 /Fe:"$OUT_DIR/screen-capture.exe" \
    "$SCRIPT_DIR/../screen-capture/windows/main.cpp" \
    /link d3d11.lib dxgi.lib
  echo "Built: $OUT_DIR/screen-capture.exe"
}

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*|Windows_NT)
    build_windows_msvc
    build_screen_capture_windows_msvc
    ;;
  Darwin)
    build_macos
    ;;
  Linux)
    echo "No native capture binaries for Linux yet."
    echo "Windows binaries are built on Windows via native/*/windows/build.bat"
    ;;
  *)
    echo "No native capture binaries for this platform ($(uname -s)). Skipping."
    ;;
esac
