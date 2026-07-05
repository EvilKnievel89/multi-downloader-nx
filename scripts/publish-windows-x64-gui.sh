#!/usr/bin/env bash
#
# publish-windows-x64-gui.sh
#
# Build and publish the Windows x64 GUI variant of multi-downloader-nx as a
# GitHub release asset. Mirrors what .github/workflows/release-matrix.yml does
# for a single variant, but from your local machine.
#
# It will:
#   1. verify prerequisites (node, pnpm, 7z, gh + auth)
#   2. build   -> pnpm run build-windows-x64-gui      (unless --skip-build)
#   3. verify  -> the .7z artifact + its .sha256 checksum
#   4. publish -> create the GitHub release (or reuse an existing tag) and
#                 upload  multi-downloader-nx-windows-x64-gui.7z (+ .sha256)
#
# Publishing is an outward-facing, hard-to-undo action, so the script asks for
# confirmation first (skip with -y) and supports --dry-run and --draft.
#
# Usage:  scripts/publish-windows-x64-gui.sh [options]
# Run     scripts/publish-windows-x64-gui.sh --help   for all options.

set -euo pipefail

# --- constants ---------------------------------------------------------------
readonly VARIANT="windows-x64-gui"
readonly BUILD_SCRIPT="build-${VARIANT}"                          # pnpm script name
readonly ARTIFACT_BASENAME="multi-downloader-nx-${VARIANT}"       # asset name stem

# Resolve the repo root from this script's location so it works from any cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly BUILD_DIR="${REPO_ROOT}/lib/_builds"
readonly ARTIFACT="${BUILD_DIR}/${ARTIFACT_BASENAME}.7z"
readonly CHECKSUM="${ARTIFACT}.sha256"

# pnpm is commonly provided via corepack shims in ~/.local/bin.
export PATH="${HOME}/.local/bin:${PATH}"

# --- defaults (overridable via flags) ----------------------------------------
TAG=""
TITLE=""
REPO=""
NOTES=""
NOTES_FILE=""
DRAFT=false
PRERELEASE=false
SKIP_BUILD=false
DRY_RUN=false
ASSUME_YES=false

# --- helpers -----------------------------------------------------------------
c_bold=$'\033[1m'; c_red=$'\033[31m'; c_grn=$'\033[32m'; c_yel=$'\033[33m'; c_off=$'\033[0m'
info()  { printf '%s==>%s %s\n'      "${c_bold}"       "${c_off}" "$*"; }
ok()    { printf '%s ok %s %s\n'     "${c_grn}"        "${c_off}" "$*"; }
warn()  { printf '%swarn%s %s\n'     "${c_yel}"        "${c_off}" "$*" >&2; }
die()   { printf '%serror%s %s\n'    "${c_red}"        "${c_off}" "$*" >&2; exit 1; }

usage() {
	cat <<EOF
${c_bold}publish-windows-x64-gui.sh${c_off} — build & publish the Windows x64 GUI release asset

Usage: scripts/publish-windows-x64-gui.sh [options]

Options:
  --tag <tag>          Release tag (default: v<version-from-package.json>)
  --title <title>      Release title (default: same as tag)
  --repo <owner/repo>  Target GitHub repo (default: derived from 'origin' remote)
  --notes <text>       Release notes body
  --notes-file <path>  Read release notes from a file
                       (if neither --notes nor --notes-file is given, notes are
                        auto-generated with 'gh --generate-notes')
  --draft              Create the release as a draft (does NOT trigger the
                       release-matrix CI; publish it later from the web UI)
  --prerelease         Mark the release as a pre-release
  --skip-build         Reuse the existing artifact instead of rebuilding
  --dry-run            Print what would happen; make no changes on GitHub
  -y, --yes            Do not prompt for confirmation
  -h, --help           Show this help

Examples:
  scripts/publish-windows-x64-gui.sh                 # build + publish v<version>
  scripts/publish-windows-x64-gui.sh --draft         # stage a draft release
  scripts/publish-windows-x64-gui.sh --skip-build -y # publish the current build
  scripts/publish-windows-x64-gui.sh --tag v5.7.4-gui --dry-run
EOF
}

# --- parse args --------------------------------------------------------------
while [[ $# -gt 0 ]]; do
	case "$1" in
		--tag)         TAG="${2:?--tag needs a value}"; shift 2 ;;
		--title)       TITLE="${2:?--title needs a value}"; shift 2 ;;
		--repo)        REPO="${2:?--repo needs a value}"; shift 2 ;;
		--notes)       NOTES="${2:?--notes needs a value}"; shift 2 ;;
		--notes-file)  NOTES_FILE="${2:?--notes-file needs a value}"; shift 2 ;;
		--draft)       DRAFT=true; shift ;;
		--prerelease)  PRERELEASE=true; shift ;;
		--skip-build)  SKIP_BUILD=true; shift ;;
		--dry-run)     DRY_RUN=true; shift ;;
		-y|--yes)      ASSUME_YES=true; shift ;;
		-h|--help)     usage; exit 0 ;;
		*)             die "Unknown option: $1 (see --help)" ;;
	esac
done

# --- prerequisites -----------------------------------------------------------
info "Checking prerequisites"
for tool in node pnpm gh; do
	command -v "$tool" >/dev/null 2>&1 || die "'$tool' not found on PATH"
done
# 7z is only needed for the build step.
if ! ${SKIP_BUILD} && ! command -v 7z >/dev/null 2>&1; then
	die "'7z' not found on PATH (needed to package the build)"
fi
gh auth status >/dev/null 2>&1 || die "gh is not authenticated — run 'gh auth login'"
ok "node $(node --version), pnpm $(pnpm --version), gh authenticated"

# --- resolve version / tag / repo --------------------------------------------
VERSION="$(node -p "require('${REPO_ROOT}/package.json').version")" \
	|| die "Could not read version from package.json"
[[ -n "${TAG}"   ]] || TAG="v${VERSION}"
[[ -n "${TITLE}" ]] || TITLE="${TAG}"

if [[ -z "${REPO}" ]]; then
	# Derive owner/repo from the origin remote URL (https or ssh form).
	origin_url="$(git -C "${REPO_ROOT}" remote get-url origin 2>/dev/null)" \
		|| die "No 'origin' remote — pass --repo owner/repo"
	REPO="$(printf '%s' "${origin_url}" \
		| sed -E 's#^git@github\.com:##; s#^https://github\.com/##; s#\.git$##')"
fi
[[ "${REPO}" == */* ]] || die "Could not determine target repo — pass --repo owner/repo"

info "Release plan"
printf '     variant : %s\n' "${VARIANT}"
printf '     repo    : %s\n' "${REPO}"
printf '     tag     : %s\n' "${TAG}"
printf '     title   : %s\n' "${TITLE}"
printf '     draft   : %s   prerelease: %s\n' "${DRAFT}" "${PRERELEASE}"
printf '     build   : %s\n' "$([[ ${SKIP_BUILD} == true ]] && echo 'skip (reuse existing)' || echo "pnpm run ${BUILD_SCRIPT}")"
${DRY_RUN} && warn "dry-run: no release will be created and nothing will be uploaded"

# --- build -------------------------------------------------------------------
if ${SKIP_BUILD}; then
	info "Skipping build (--skip-build)"
else
	info "Installing dependencies  (pnpm install)"
	( cd "${REPO_ROOT}" && pnpm install ) || die "pnpm install failed"
	info "Building ${VARIANT}  (pnpm run ${BUILD_SCRIPT})"
	( cd "${REPO_ROOT}" && pnpm run "${BUILD_SCRIPT}" ) || die "Build failed"
	ok "Build finished"
fi

# --- verify artifacts --------------------------------------------------------
info "Verifying artifacts"
[[ -f "${ARTIFACT}" ]] || die "Artifact not found: ${ARTIFACT} (run without --skip-build?)"
[[ -f "${CHECKSUM}" ]] || die "Checksum not found: ${CHECKSUM}"
# The .sha256 references the file by its bare name, so verify from inside _builds.
( cd "${BUILD_DIR}" && sha256sum -c "$(basename "${CHECKSUM}")" ) \
	|| die "Checksum verification failed for ${ARTIFACT}"
artifact_size="$(du -h "${ARTIFACT}" | cut -f1)"
ok "$(basename "${ARTIFACT}") (${artifact_size}) + checksum verified"

# --- confirm -----------------------------------------------------------------
if ! ${DRY_RUN} && ! ${ASSUME_YES}; then
	if ! ${DRAFT}; then
		warn "Publishing a non-draft release on '${REPO}' may trigger its"
		warn "release-matrix workflow (rebuilds/uploads every variant). Use --draft to avoid."
	fi
	printf '%sPublish %s to %s now? [y/N] %s' "${c_bold}" "${TAG}" "${REPO}" "${c_off}"
	read -r reply
	[[ "${reply}" =~ ^[Yy]$ ]] || die "Aborted by user"
fi

# --- assemble gh args --------------------------------------------------------
notes_args=()
if [[ -n "${NOTES_FILE}" ]]; then
	[[ -f "${NOTES_FILE}" ]] || die "notes file not found: ${NOTES_FILE}"
	notes_args=(--notes-file "${NOTES_FILE}")
elif [[ -n "${NOTES}" ]]; then
	notes_args=(--notes "${NOTES}")
else
	notes_args=(--generate-notes)
fi
${DRAFT}      && notes_args+=(--draft)
${PRERELEASE} && notes_args+=(--prerelease)

run() {  # echo (shell-quoted, copy-paste-safe) + execute, or just echo in dry-run
	printf '   $'; printf ' %q' "$@"; printf '\n'
	${DRY_RUN} || "$@"
}

# --- publish -----------------------------------------------------------------
if gh release view "${TAG}" --repo "${REPO}" >/dev/null 2>&1; then
	info "Release ${TAG} already exists — uploading assets (clobber)"
	run gh release upload "${TAG}" "${ARTIFACT}" "${CHECKSUM}" --repo "${REPO}" --clobber
else
	info "Creating release ${TAG} and uploading assets"
	run gh release create "${TAG}" "${ARTIFACT}" "${CHECKSUM}" \
		--repo "${REPO}" --title "${TITLE}" "${notes_args[@]}"
fi

if ${DRY_RUN}; then
	warn "dry-run complete — nothing was published"
else
	url="$(gh release view "${TAG}" --repo "${REPO}" --json url --jq .url 2>/dev/null || true)"
	ok "Done. Release: ${url:-https://github.com/${REPO}/releases/tag/${TAG}}"
fi
