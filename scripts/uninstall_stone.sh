#!/bin/bash

# Stone App Uninstaller & Cache Cleaner

APP_NAME="Stone"
APP_PATH="/Applications/Stone.app"

# Directories to clean (using ~ expansion)
PATHS_TO_REMOVE=(
  "$APP_PATH"
  "$HOME/Library/Application Support/stone"
  "$HOME/Library/Application Support/com.stone.Stone"
  "$HOME/Library/Caches/com.stone.Stone"
  "$HOME/Library/Caches/com.stone.Stone.ShipIt"
  "$HOME/Library/Preferences/com.stone.Stone.plist"
  "$HOME/Library/Saved Application State/com.stone.Stone.savedState"
  "$HOME/Library/Logs/Stone"
)

echo "Starting cleanup for $APP_NAME..."

# 1. Kill running processes
echo "Checking for running processes..."
if pgrep -f "$APP_NAME" > /dev/null; then
  echo "Found running $APP_NAME processes. Terminating..."
  pkill -f "$APP_NAME"
  sleep 1
  # Double check
  if pgrep -f "$APP_NAME" > /dev/null; then
    echo "Force killing..."
    pkill -9 -f "$APP_NAME"
  fi
else
  echo "No running processes found."
fi

# 2. Remove files and directories
echo "Removing application and data files..."

for path in "${PATHS_TO_REMOVE[@]}"; do
  if [ -e "$path" ]; then
    echo "Removing: $path"
    rm -rf "$path"
  else
    echo "Not found (skipping): $path"
  fi
done

echo "Cleanup complete!"
