#!/bin/bash
# Build the native macOS helpers (currently: stone-audio-tap).
# No-op on other platforms so the cross-platform build chain can call it
# unconditionally.

set -e

if [[ "$(uname)" != "Darwin" ]]; then
  echo "build-native: not macOS, skipping"
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NATIVE_DIR="$PROJECT_ROOT/native"
BIN_DIR="$NATIVE_DIR/bin"

mkdir -p "$BIN_DIR"

echo "build-native: compiling stone-audio-tap…"
swiftc -O \
  -framework ScreenCaptureKit \
  -framework AVFoundation \
  -framework CoreMedia \
  -framework CoreGraphics \
  -o "$BIN_DIR/stone-audio-tap" \
  "$NATIVE_DIR/SystemAudioTap.swift"

echo "build-native: ✓ $BIN_DIR/stone-audio-tap"
