#!/usr/bin/env bash
set -euo pipefail

OWNER="Gryt-chat"
REPO="gryt"
DOCKER_IMAGE="ghcr.io/gryt-chat/client"

# ── Colors ───────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

info()  { echo -e "${CYAN}ℹ${RESET}  $*"; }
ok()    { echo -e "${GREEN}✔${RESET}  $*"; }
warn()  { echo -e "${YELLOW}⚠${RESET}  $*"; }
err()   { echo -e "${RED}✖${RESET}  $*" >&2; }

echo ""
echo -e "${BOLD}┌──────────────────────────────────────────┐${RESET}"
echo -e "${BOLD}│     Gryt Desktop — Promote to Stable      │${RESET}"
echo -e "${BOLD}└──────────────────────────────────────────┘${RESET}"
echo ""

# ── Prerequisites ────────────────────────────────────────────────────────
if ! command -v gh &>/dev/null; then
  err "gh CLI is required. Install: https://cli.github.com"
  exit 1
fi

if ! gh auth status &>/dev/null 2>&1; then
  err "gh CLI is not authenticated. Run: gh auth login"
  exit 1
fi

# ── List prerelease releases ─────────────────────────────────────────────
info "Fetching recent prereleases from ${BOLD}${OWNER}/${REPO}${RESET}…"
echo ""

RELEASES=$(gh release list --repo "${OWNER}/${REPO}" --limit 10 \
  --json tagName,name,isPrerelease,publishedAt,isDraft \
  --jq '[.[] | select(.isPrerelease == true and .isDraft == false)] | .[:8]')

COUNT=$(echo "$RELEASES" | jq 'length')
if [ "$COUNT" -eq 0 ]; then
  warn "No prereleases found."
  exit 0
fi

echo -e "${BOLD}  #   Tag                  Published${RESET}"
echo    "  ─── ──────────────────── ──────────────────────"
for i in $(seq 0 $((COUNT - 1))); do
  TAG=$(echo "$RELEASES" | jq -r ".[$i].tagName")
  DATE=$(echo "$RELEASES" | jq -r ".[$i].publishedAt" | cut -c1-10)
  printf "  %d)  %-20s %s\n" $((i + 1)) "$TAG" "$DATE"
done
echo ""

read -rp "$(echo -e "${CYAN}?${RESET}  Promote which release? ${YELLOW}[1]${RESET}: ")" CHOICE
CHOICE="${CHOICE:-1}"

if ! [[ "$CHOICE" =~ ^[0-9]+$ ]] || [ "$CHOICE" -lt 1 ] || [ "$CHOICE" -gt "$COUNT" ]; then
  err "Invalid choice"
  exit 1
fi

TAG=$(echo "$RELEASES" | jq -r ".[$(( CHOICE - 1 ))].tagName")
VERSION="${TAG#v}"

echo ""
echo -e "${BOLD}── Summary ──────────────────────────────${RESET}"
echo -e "  Release:    ${YELLOW}${TAG}${RESET}"
echo -e "  Action:     Mark as ${GREEN}stable${RESET} (non-prerelease)"
echo -e "${BOLD}─────────────────────────────────────────${RESET}"
echo ""
read -rp "$(echo -e "${CYAN}?${RESET}  Proceed? ${YELLOW}[Y/n]${RESET}: ")" CONFIRM
CONFIRM="${CONFIRM:-Y}"
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  warn "Aborted."
  exit 0
fi

# ── Ensure latest.yml manifests exist ────────────────────────────────────
# Beta releases publish beta.yml; the client reads latest.yml.
# Copy them over if missing so stable-channel users can find the update.
if [[ "$VERSION" == *-* ]]; then
  CHANNEL="${VERSION##*-}"
  info "Ensuring latest.yml manifests exist (from ${CHANNEL}.yml)…"
  TMPDIR_YML=$(mktemp -d)
  for SUFFIX in "" "-linux" "-mac"; do
    SRC="${CHANNEL}${SUFFIX}.yml"
    DST="latest${SUFFIX}.yml"
    EXISTING=$(gh release download "$TAG" --repo "${OWNER}/${REPO}" -p "$DST" -O - 2>/dev/null | head -n1 || true)
    if [ -n "$EXISTING" ]; then
      ok "${DST} already present"
    elif gh release download "$TAG" --repo "${OWNER}/${REPO}" -p "$SRC" -O "${TMPDIR_YML}/${DST}" 2>/dev/null; then
      gh release upload "$TAG" --repo "${OWNER}/${REPO}" "${TMPDIR_YML}/${DST}" --clobber
      ok "${SRC} → ${DST}"
    else
      warn "Could not download ${SRC} — ${DST} not uploaded"
    fi
  done
  rm -rf "$TMPDIR_YML"
fi

# ── Flip prerelease → release ────────────────────────────────────────────
info "Promoting ${BOLD}${TAG}${RESET} to stable…"
gh release edit "$TAG" --repo "${OWNER}/${REPO}" --prerelease=false
ok "Release ${BOLD}${TAG}${RESET} is now marked as stable"

# ── Docker re-tag ────────────────────────────────────────────────────────
echo ""
read -rp "$(echo -e "${CYAN}?${RESET}  Also tag Docker image as :latest? ${YELLOW}[Y/n]${RESET}: ")" DOCKER_CONFIRM
DOCKER_CONFIRM="${DOCKER_CONFIRM:-Y}"
if [[ "$DOCKER_CONFIRM" =~ ^[Yy]$ ]]; then
  info "Tagging ${BOLD}${DOCKER_IMAGE}:${VERSION}${RESET} → ${BOLD}:latest${RESET}…"
  if docker buildx imagetools create -t "${DOCKER_IMAGE}:latest" "${DOCKER_IMAGE}:${VERSION}" 2>/dev/null; then
    ok "Docker image tagged as :latest"
  else
    warn "docker buildx imagetools failed — trying docker tag + push…"
    docker pull "${DOCKER_IMAGE}:${VERSION}"
    docker tag "${DOCKER_IMAGE}:${VERSION}" "${DOCKER_IMAGE}:latest"
    docker push "${DOCKER_IMAGE}:latest"
    ok "Docker image tagged as :latest"
  fi
fi

echo ""
ok "Promotion complete! Stable-channel users will now see ${BOLD}${TAG}${RESET}."
echo ""
