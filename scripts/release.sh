#!/bin/bash

# Stone Release Script
# Usage: pnpm release [patch|minor|major]
#        pnpm release --tag [vX.Y.Z]
#        pnpm release --help

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

usage() {
  cat <<EOF
Stone Release Script

Usage:
  pnpm release [patch|minor|major] [--push]   Bump version, commit, tag, and push the new tag (default: patch)
  pnpm release --tag [vX.Y.Z]                  Push an existing tag without bumping (default: current package.json version)
  pnpm release --help                          Show this help message

Options:
  --push   Auto-push the tag after the bump without prompting for confirmation

Examples:
  pnpm release                # patch bump (e.g. 0.6.3 -> 0.6.4), prompts before push
  pnpm release minor          # minor bump (e.g. 0.6.3 -> 0.7.0)
  pnpm release major          # major bump (e.g. 0.6.3 -> 1.0.0)
  pnpm release patch --push   # patch bump and auto-push the new tag
  pnpm release --tag          # re-push the tag for the current version
  pnpm release --tag v0.6.3
EOF
}

# Push only the given tag (plus the current branch) to origin.
push_tag() {
  local tag="$1"
  echo -e "${YELLOW}Pushing branch and tag $tag to origin...${NC}"
  git push origin HEAD
  git push origin "refs/tags/$tag"
  echo -e "${GREEN}✓ Pushed tag $tag${NC}"
  echo -e "${GREEN}The release workflow will now build and create a GitHub release.${NC}"
}

# --- Argument parsing ---------------------------------------------------------

case "${1:-}" in
  -h|--help|help)
    usage
    exit 0
    ;;
  --tag)
    # Push an existing tag without bumping the version.
    TAG="${2:-}"
    if [[ -z "$TAG" ]]; then
      CURRENT_VERSION=$(node -p "require('./package.json').version")
      TAG="v$CURRENT_VERSION"
    fi
    if ! git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
      echo -e "${RED}Error: tag '$TAG' does not exist locally. Create it first or run a version bump.${NC}"
      exit 1
    fi
    push_tag "$TAG"
    exit 0
    ;;
esac

# Parse bump type and the optional --push flag (order-independent).
AUTO_PUSH=false
BUMP_TYPE=""
for arg in "$@"; do
  case "$arg" in
    --push)
      AUTO_PUSH=true
      ;;
    patch|minor|major)
      BUMP_TYPE="$arg"
      ;;
    *)
      echo -e "${RED}Error: Unknown argument '$arg'${NC}"
      echo "Run 'pnpm release --help' for usage."
      exit 1
      ;;
  esac
done
BUMP_TYPE=${BUMP_TYPE:-patch}

if [[ ! "$BUMP_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo -e "${RED}Error: Invalid bump type. Use 'patch', 'minor', or 'major'${NC}"
  echo "Run 'pnpm release --help' for usage."
  exit 1
fi

# Check if working directory is clean
if [[ -n $(git status -s) ]]; then
  echo -e "${RED}Error: Working directory is not clean. Commit or stash your changes first.${NC}"
  git status -s
  exit 1
fi

# Check if on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo -e "${YELLOW}Warning: You are not on the main branch (current: $CURRENT_BRANCH)${NC}"
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}Current version: $CURRENT_VERSION${NC}"

# Calculate new version
IFS='.' read -r -a VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR="${VERSION_PARTS[0]}"
MINOR="${VERSION_PARTS[1]}"
PATCH="${VERSION_PARTS[2]}"

case "$BUMP_TYPE" in
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  patch)
    PATCH=$((PATCH + 1))
    ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
NEW_TAG="v$NEW_VERSION"
echo -e "${GREEN}New version: $NEW_VERSION${NC}"

# Confirm
read -p "Create release $NEW_TAG? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Release cancelled"
  exit 1
fi

# Update package.json version
echo -e "${YELLOW}Updating package.json...${NC}"
# Use Node.js to update package.json properly
node -e "
  const fs = require('fs');
  const pkg = require('./package.json');
  pkg.version = '$NEW_VERSION';
  fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Git commit and tag
echo -e "${YELLOW}Creating git commit and tag...${NC}"
git add package.json
git commit -m "chore: bump version to $NEW_VERSION"
git tag -a "$NEW_TAG" -m "Release $NEW_TAG"

echo -e "${GREEN}✓ Version bumped to $NEW_VERSION${NC}"
echo -e "${GREEN}✓ Git tag $NEW_TAG created${NC}"
echo ""

# Push the tag — auto-push with --push, otherwise confirm.
if [[ "$AUTO_PUSH" == true ]]; then
  push_tag "$NEW_TAG"
else
  read -p "Push $NEW_TAG to origin now? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    push_tag "$NEW_TAG"
  else
    echo -e "${YELLOW}Skipped push. To push later, run:${NC}"
    echo "  pnpm release --tag $NEW_TAG"
  fi
fi
