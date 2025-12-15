#!/bin/bash
# Convert PNG icon to all required formats for electron-builder
# Source: public/icon.png (committed to repo)
# Output: build/icon.{png,icns,ico} (generated for packaging)
#
# Cross-platform: uses ImageMagick (install via brew/apt/choco)
# macOS .icns requires iconutil (built-in on macOS)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PUBLIC_DIR="$PROJECT_ROOT/public"
BUILD_DIR="$PROJECT_ROOT/build"
SOURCE_FILE="$PUBLIC_DIR/icon.png"

if [ ! -f "$SOURCE_FILE" ]; then
    echo "Error: $SOURCE_FILE not found"
    echo "Please save your icon as public/icon.png"
    exit 1
fi

# Find ImageMagick command (magick on v7+, convert on v6)
if command -v magick &> /dev/null; then
    CONVERT="magick"
elif command -v convert &> /dev/null; then
    CONVERT="convert"
else
    echo "Error: ImageMagick is not installed."
    echo "Install it:"
    echo "  macOS:  brew install imagemagick"
    echo "  Ubuntu: sudo apt-get install imagemagick"
    echo "  Windows: choco install imagemagick"
    exit 1
fi

echo "Converting PNG to icon formats..."
echo "Using: $CONVERT"

mkdir -p "$BUILD_DIR"
mkdir -p "$BUILD_DIR/icons"

# Add macOS-style padding and rounded corners
echo "Adding macOS-style padding and rounded corners..."
TEMP_PADDED="$BUILD_DIR/icons/temp_padded.png"
$CONVERT "$SOURCE_FILE" -gravity center -background none -extent 125%x125% "$TEMP_PADDED"

# Generate PNGs at required sizes with rounded corners
echo "Creating resized PNGs with rounded corners..."
for size in 16 32 48 64 128 256 512 1024; do
    echo "  ${size}x${size}..."
    # Calculate corner radius (22.37% of size for macOS Big Sur style rounding)
    radius=$(echo "$size * 0.2237" | bc | cut -d. -f1)

    # Create rounded rectangle mask (white on black)
    $CONVERT -size ${size}x${size} xc:black -fill white \
        -draw "roundrectangle 0,0,$((size-1)),$((size-1)),${radius},${radius}" \
        "$BUILD_DIR/icons/mask_${size}.png"

    # Resize icon and apply mask to create rounded corners
    $CONVERT "$TEMP_PADDED" -resize "${size}x${size}" \
        "$BUILD_DIR/icons/mask_${size}.png" \
        -compose CopyOpacity -composite \
        "$BUILD_DIR/icons/icon_${size}.png"

    # Clean up mask
    rm -f "$BUILD_DIR/icons/mask_${size}.png"
done

# Clean up temp padded file
rm -f "$TEMP_PADDED"
echo "✓ Added rounded corners"

# Copy 1024px version as the main icon.png (Linux)
cp "$BUILD_DIR/icons/icon_1024.png" "$BUILD_DIR/icon.png"
echo "✓ icon.png (Linux)"

# Create ICNS for macOS (requires iconutil - macOS only)
if [[ "$OSTYPE" == "darwin"* ]] && command -v iconutil &> /dev/null; then
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
    echo "✓ icon.icns (macOS)"
else
    echo "⊘ Skipping icon.icns (macOS only, requires iconutil)"
fi

# Create ICO for Windows (multi-resolution)
echo "Creating icon.ico for Windows..."
$CONVERT "$BUILD_DIR/icons/icon_16.png" \
         "$BUILD_DIR/icons/icon_32.png" \
         "$BUILD_DIR/icons/icon_48.png" \
         "$BUILD_DIR/icons/icon_64.png" \
         "$BUILD_DIR/icons/icon_128.png" \
         "$BUILD_DIR/icons/icon_256.png" \
         "$BUILD_DIR/icon.ico"
echo "✓ icon.ico (Windows)"

# Clean up temp files
rm -rf "$BUILD_DIR/icons"

echo ""
echo "Icon conversion complete!"
