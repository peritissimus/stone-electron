#!/bin/bash
# Convert PNG icon to all required formats for electron-builder

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_ROOT/build"
PNG_FILE="$BUILD_DIR/icon.png"

if [ ! -f "$PNG_FILE" ]; then
    echo "Error: $PNG_FILE not found"
    echo "Please save your icon as build/icon.png first"
    exit 1
fi

echo "Converting PNG to icon formats..."

# Create temp directory for resized icons
mkdir -p "$BUILD_DIR/icons"

# Generate PNGs at required sizes from source
echo "Creating resized PNGs..."
for size in 16 32 48 64 128 256 512 1024; do
    echo "  ${size}x${size}..."
    sips -z $size $size "$PNG_FILE" --out "$BUILD_DIR/icons/icon_${size}.png" >/dev/null 2>&1
done

# Create ICNS for macOS
echo "Creating icon.icns for macOS..."
mkdir -p "$BUILD_DIR/icon.iconset"

cp "$BUILD_DIR/icons/icon_16.png" "$BUILD_DIR/icon.iconset/icon_16x16.png"
cp "$BUILD_DIR/icons/icon_32.png" "$BUILD_DIR/icon.iconset/icon_16x16@2x.png"
cp "$BUILD_DIR/icons/icon_32.png" "$BUILD_DIR/icon.iconset/icon_32x32.png"
cp "$BUILD_DIR/icons/icon_64.png" "$BUILD_DIR/icon.iconset/icon_32x32@2x.png"
cp "$BUILD_DIR/icons/icon_128.png" "$BUILD_DIR/icon.iconset/icon_128x128.png"
cp "$BUILD_DIR/icons/icon_256.png" "$BUILD_DIR/icon.iconset/icon_128x128@2x.png"
cp "$BUILD_DIR/icons/icon_256.png" "$BUILD_DIR/icon.iconset/icon_256x256.png"
cp "$BUILD_DIR/icons/icon_512.png" "$BUILD_DIR/icon.iconset/icon_256x256@2x.png"
cp "$BUILD_DIR/icons/icon_512.png" "$BUILD_DIR/icon.iconset/icon_512x512.png"
cp "$BUILD_DIR/icons/icon_1024.png" "$BUILD_DIR/icon.iconset/icon_512x512@2x.png"

iconutil -c icns "$BUILD_DIR/icon.iconset" -o "$BUILD_DIR/icon.icns"
rm -rf "$BUILD_DIR/icon.iconset"

# Create ICO for Windows
echo "Creating icon.ico for Windows..."
magick "$BUILD_DIR/icons/icon_16.png" \
       "$BUILD_DIR/icons/icon_32.png" \
       "$BUILD_DIR/icons/icon_48.png" \
       "$BUILD_DIR/icons/icon_64.png" \
       "$BUILD_DIR/icons/icon_128.png" \
       "$BUILD_DIR/icons/icon_256.png" \
       "$BUILD_DIR/icon.ico"

# Clean up
rm -rf "$BUILD_DIR/icons"

echo ""
echo "✓ Icon conversion complete!"
echo "  - icon.png (Linux)"
echo "  - icon.icns (macOS)"
echo "  - icon.ico (Windows)"
