#!/bin/bash
#
# build-whisper — compile the whisper.cpp binaries that power transcription.
#
# Clones a pinned whisper.cpp, builds self-contained `whisper-cli` (batch) and
# `whisper-server` (keeps the model resident for low-latency live/streaming
# transcription) — static libs so there are no .dylib siblings to bundle; Metal
# shaders embedded on macOS. Drops both at vendor/whisper/bin/. The
# WhisperCppTranscriber adapter spawns whisper-cli; the live path uses the
# server. electron-builder bundles both.
#
# Models are NOT downloaded here — the app fetches the GGML model on first use.
set -e

WHISPER_VERSION="v1.8.6"
SRC_DIR="vendor/whisper.cpp"
OUT_DIR="vendor/whisper/bin"

case "$(uname)" in
  Darwin|Linux) ;;
  *) echo "build-whisper: $(uname) not supported here (Windows uses its own toolchain) — skipping"; exit 0 ;;
esac

if ! command -v cmake >/dev/null 2>&1; then
  echo "build-whisper: cmake not found. Install it (brew install cmake) and re-run." >&2
  exit 1
fi

if [ ! -d "$SRC_DIR" ]; then
  echo "build-whisper: cloning whisper.cpp $WHISPER_VERSION…"
  git clone --depth 1 --branch "$WHISPER_VERSION" https://github.com/ggml-org/whisper.cpp "$SRC_DIR"
fi

echo "build-whisper: configuring…"
cmake -S "$SRC_DIR" -B "$SRC_DIR/build" \
  -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_SHARED_LIBS=OFF \
  -DGGML_METAL_EMBED_LIBRARY=ON \
  -DWHISPER_BUILD_TESTS=OFF \
  -DWHISPER_BUILD_SERVER=ON \
  -DWHISPER_BUILD_EXAMPLES=ON

echo "build-whisper: building whisper-cli + whisper-server…"
cmake --build "$SRC_DIR/build" --config Release -j --target whisper-cli whisper-server

mkdir -p "$OUT_DIR"
for name in whisper-cli whisper-server; do
  BIN="$SRC_DIR/build/bin/$name"
  if [ ! -f "$BIN" ]; then
    echo "build-whisper: expected binary not found at $BIN" >&2
    exit 1
  fi
  cp "$BIN" "$OUT_DIR/$name"
  echo "build-whisper: ✓ $OUT_DIR/$name"
done
