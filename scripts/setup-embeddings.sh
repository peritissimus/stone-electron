#!/bin/bash
# Setup script for Stone embeddings service
# Uses uv for fast, isolated Python environment management

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Setting up Stone embeddings environment with uv..."

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "Error: uv is not installed. Install it with:"
    echo "  curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Create virtual environment and install dependencies
echo "Creating virtual environment and installing dependencies..."
uv sync

# Test the installation
echo "Testing embedding service..."
echo '{"cmd": "ping", "id": 1}' | uv run python embedding_server.py

echo ""
echo "Setup complete! The embedding service is ready."
echo "Run with: uv run python scripts/embedding_server.py"
