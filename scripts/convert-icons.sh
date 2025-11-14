#!/bin/bash
# Convert SVG logo to all required icon formats for electron-builder

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_ROOT/build"
SVG_FILE="$BUILD_DIR/icon.svg"

echo "Converting SVG to icon formats..."

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick is not installed."
    echo "Please install it:"
    echo "  macOS: brew install imagemagick"
    echo "  Linux: sudo apt-get install imagemagick"
    exit 1
fi

# Create PNG files at various sizes (needed for ICO and ICNS)
echo "Creating PNG files..."
mkdir -p "$BUILD_DIR/icons"

# Generate PNGs at required sizes
for size in 16 32 48 64 128 256 512 1024; do
    echo "  ${size}x${size}..."
    convert -background none "$SVG_FILE" -resize "${size}x${size}" "$BUILD_DIR/icons/icon_${size}.png"
done

# Create main icon.png (1024x1024 for Linux)
echo "Creating icon.png for Linux..."
cp "$BUILD_DIR/icons/icon_1024.png" "$BUILD_DIR/icon.png"

# Create ICNS for macOS (requires iconutil on macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Creating icon.icns for macOS..."
    mkdir -p "$BUILD_DIR/icon.iconset"

    # Copy PNGs into iconset with required naming
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

    # Convert to ICNS
    iconutil -c icns "$BUILD_DIR/icon.iconset" -o "$BUILD_DIR/icon.icns"

    # Clean up
    rm -rf "$BUILD_DIR/icon.iconset"
else
    echo "Skipping ICNS creation (macOS only)"
fi

# Create ICO for Windows (multi-resolution)
echo "Creating icon.ico for Windows..."
convert "$BUILD_DIR/icons/icon_16.png" \
        "$BUILD_DIR/icons/icon_32.png" \
        "$BUILD_DIR/icons/icon_48.png" \
        "$BUILD_DIR/icons/icon_64.png" \
        "$BUILD_DIR/icons/icon_128.png" \
        "$BUILD_DIR/icons/icon_256.png" \
        "$BUILD_DIR/icon.ico"

# Clean up temporary PNG files
echo "Cleaning up temporary files..."
rm -rf "$BUILD_DIR/icons"

echo ""
echo "✓ Icon conversion complete!"
echo "  - icon.png (Linux)"
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "  - icon.icns (macOS)"
fi
echo "  - icon.ico (Windows)"
