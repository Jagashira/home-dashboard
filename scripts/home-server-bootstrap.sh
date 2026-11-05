#!/usr/bin/env bash
set -Eeuo pipefail

# Bootstrap the production home-server stack from the home-platform compose project.
# This script intentionally does not run this repository's standalone docker-compose.yml,
# because port 3000 is owned by home-platform-home-dashboard in production.

HOME_PLATFORM_DIR="${HOME_PLATFORM_DIR:-/home/home-server/home-platform}"
HOME_DASHBOARD_DIR="${HOME_DASHBOARD_DIR:-/home/home-server/home-dashboard}"
HOME_DASHBOARD_URL="${HOME_DASHBOARD_URL:-http://127.0.0.1:3000}"
NEWS_FETCH_LOG="${NEWS_FETCH_LOG:-$HOME/home-dashboard-news-fetch.log}"
INSTALL_CRON="${INSTALL_CRON:-1}"
UPDATE_GIT="${UPDATE_GIT:-1}"
BUILD_DASHBOARD="${BUILD_DASHBOARD:-1}"
RUN_NEWS_FETCH="${RUN_NEWS_FETCH:-0}"

CRON_BEGIN="# home-dashboard news fetch: begin"
CRON_END="# home-dashboard news fetch: end"
CRON_LINE="0 6 * * * curl -fsS -X POST \"${HOME_DASHBOARD_URL}/api/fetch\" >> \"${NEWS_FETCH_LOG}\" 2>&1"

log() {
  printf '[home-server-bootstrap] %s\n' "$*"
}

fail() {
  printf '[home-server-bootstrap] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

ensure_dir() {
  [[ -d "$1" ]] || fail "directory not found: $1"
}

git_update_if_clean() {
  local repo_dir="$1"

  ensure_dir "$repo_dir"
  if [[ ! -d "$repo_dir/.git" ]]; then
    log "skip git update, not a git repo: $repo_dir"
    return
  fi

  if [[ -n "$(git -C "$repo_dir" status --short)" ]]; then
    log "skip git pull, working tree has local changes: $repo_dir"
    git -C "$repo_dir" status --short
    return
  fi

  log "git pull: $repo_dir"
  git -C "$repo_dir" pull --ff-only
}

detect_dashboard_service() {
  local service_name

  service_name="$(
    docker inspect home-platform-home-dashboard \
      --format '{{ index .Config.Labels "com.docker.compose.service" }}' \
      2>/dev/null || true
  )"

  if [[ -n "$service_name" ]]; then
    printf '%s\n' "$service_name"
    return
  fi

  if docker compose --project-directory "$HOME_PLATFORM_DIR" config --services | grep -qx 'home-dashboard'; then
    printf '%s\n' "home-dashboard"
    return
  fi

  fail "could not detect home-dashboard compose service in $HOME_PLATFORM_DIR"
}

install_news_cron() {
  local existing
  local filtered
  local next

  existing="$(crontab -l 2>/dev/null || true)"
  filtered="$(printf '%s\n' "$existing" | sed "/^${CRON_BEGIN}$/,/^${CRON_END}$/d")"
  next="$(
    printf '%s\n' "$filtered" | sed '/^[[:space:]]*$/N;/^\n$/D'
    printf '%s\n%s\n%s\n' "$CRON_BEGIN" "$CRON_LINE" "$CRON_END"
  )"

  printf '%s\n' "$next" | crontab -
  log "installed daily 06:00 news fetch cron"
}

main() {
  require_command docker
  require_command curl
  require_command git
  require_command sed
  require_command crontab

  ensure_dir "$HOME_PLATFORM_DIR"

  if [[ "$UPDATE_GIT" == "1" ]]; then
    git_update_if_clean "$HOME_PLATFORM_DIR"
    git_update_if_clean "$HOME_DASHBOARD_DIR"
  fi

  local dashboard_service
  dashboard_service="$(detect_dashboard_service)"
  log "home-dashboard service: $dashboard_service"

  if [[ "$INSTALL_CRON" == "1" ]]; then
    install_news_cron
  fi

  if [[ "$BUILD_DASHBOARD" == "1" ]]; then
    log "docker compose up -d --build $dashboard_service"
    docker compose --project-directory "$HOME_PLATFORM_DIR" up -d --build "$dashboard_service"
  else
    log "docker compose up -d"
    docker compose --project-directory "$HOME_PLATFORM_DIR" up -d
  fi

  log "container status"
  docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}' | grep -E 'NAMES|home-platform-home-dashboard|home-platform-api|immich|smb' || true

  log "health check: ${HOME_DASHBOARD_URL}/api/health"
  curl -fsS "${HOME_DASHBOARD_URL}/api/health"
  printf '\n'

  if [[ "$RUN_NEWS_FETCH" == "1" ]]; then
    log "manual news fetch"
    curl -fsS -X POST "${HOME_DASHBOARD_URL}/api/fetch"
    printf '\n'
  fi

  log "done"
}

main "$@"
