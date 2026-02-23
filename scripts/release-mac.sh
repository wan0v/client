#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLIENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script must be run on macOS."
  exit 1
fi

if ! command -v xcrun >/dev/null 2>&1; then
  echo "Xcode command line tools are required (missing xcrun)."
  echo "Install with: xcode-select --install"
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is required (missing gh)."
  echo "Install: https://cli.github.com/"
  exit 1
fi

cd "$CLIENT_DIR"

VERSION="$(node -p "require('./package.json').version")"
TAG="v${VERSION}"

echo ""
echo "Gryt Desktop — macOS signed + notarized build"
echo "Version: ${VERSION}"
echo ""

if [[ -z "${CSC_NAME:-}" ]]; then
  echo "Missing CSC_NAME."
  echo "Set it to your Developer ID Application identity, e.g.:"
  echo "  export CSC_NAME='Developer ID Application: <Your Name/Company> (<TEAMID>)'"
  echo ""
  echo "Available identities:"
  security find-identity -v -p codesigning || true
  exit 1
fi

HAS_API_KEY=false
if [[ -n "${APPLE_NOTARYTOOL_KEYCHAIN_PROFILE:-}" ]]; then
  HAS_API_KEY=true
else
  if [[ -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_ISSUER:-}" ]]; then
    HAS_API_KEY=true
  fi
fi

if [[ "$HAS_API_KEY" != "true" ]]; then
  echo "Missing notarization credentials."
  echo "Use one of:"
  echo "  export APPLE_NOTARYTOOL_KEYCHAIN_PROFILE='my-notary-profile'"
  echo "or:"
  echo "  export APPLE_API_KEY='/absolute/path/to/AuthKey_XXXXXXXXXX.p8'"
  echo "  export APPLE_API_ISSUER='xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'"
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Installing dependencies (node_modules missing)…"
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi
fi

echo ""
echo "Building renderer…"
ELECTRON=1 npx vite build

echo ""
echo "Packaging (macOS only)…"
export DEBUG="${DEBUG:-}"
npx electron-builder --mac --publish never

echo ""
echo "Artifacts in: ${CLIENT_DIR}/release"
ls -la "${CLIENT_DIR}/release" | sed -e 's/^/  /'

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo ""
  echo "GH_TOKEN not set — skipping upload to GitHub release."
  echo "If you want to upload, set GH_TOKEN (or run 'gh auth login') and re-run."
  exit 0
fi

OWNER="Gryt-chat"
REPO="gryt"

echo ""
echo "Uploading mac artifacts to GitHub release ${TAG}…"

if ! gh release view "${TAG}" --repo "${OWNER}/${REPO}" >/dev/null 2>&1; then
  echo "Release ${TAG} not found on ${OWNER}/${REPO}."
  echo "Create the release/tag first (e.g. run the normal release flow), then re-run."
  exit 1
fi

shopt -s nullglob
ASSETS=(
  "${CLIENT_DIR}/release/"*"-mac-"*.dmg
  "${CLIENT_DIR}/release/"*"-mac-"*.zip
  "${CLIENT_DIR}/release/"*"-mac-"*.zip.blockmap
  "${CLIENT_DIR}/release/latest-mac.yml"
)
shopt -u nullglob

if [[ "${#ASSETS[@]}" -eq 0 ]]; then
  echo "No mac assets found to upload."
  exit 1
fi

gh release upload "${TAG}" "${ASSETS[@]}" --repo "${OWNER}/${REPO}" --clobber

echo ""
echo "Done."

