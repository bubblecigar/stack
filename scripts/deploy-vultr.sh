#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${VULTR_HOST:?Set VULTR_HOST to your Vultr server IP or DNS name.}"

VULTR_USER="${VULTR_USER:-root}"
APP_DOMAIN="${APP_DOMAIN:-$VULTR_HOST}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-http://$APP_DOMAIN}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/opt/stack}"
WEB_ROOT="${WEB_ROOT:-/var/www/stack}"
DATA_DIR="${DATA_DIR:-/var/lib/stack}"
AUTH_PORT="${AUTH_PORT:-4100}"
API_PORT="${API_PORT:-4101}"
NGINX_HTTP_PORT="${NGINX_HTTP_PORT:-80}"
NODE_BIN="${NODE_BIN:-/usr/bin/node}"
BUILD_DIR="${BUILD_DIR:-dist}"
INSTALL_DEPS="${INSTALL_DEPS:-0}"
DISABLE_CADDY="${DISABLE_CADDY:-0}"
SSH_TARGET="${VULTR_USER}@${VULTR_HOST}"

export EXPO_PUBLIC_AUTH_SERVER_URL="$PUBLIC_ORIGIN"
export EXPO_PUBLIC_API_SERVER_URL="$PUBLIC_ORIGIN"

SSH_CMD=(ssh)
SCP_CMD=(scp)
RSYNC_SSH_CMD=(ssh)

if [[ -n "${VULTR_PASSWORD:-}" ]]; then
  if command -v sshpass >/dev/null 2>&1; then
    SSH_CMD=(sshpass -e ssh)
    SCP_CMD=(sshpass -e scp)
    RSYNC_SSH_CMD=(sshpass -e ssh)
    export SSHPASS="$VULTR_PASSWORD"
  else
    echo "VULTR_PASSWORD is set, but sshpass is not installed. Falling back to normal SSH auth." >&2
  fi
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

escape_sed() {
  printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'
}

render_template() {
  local source="$1"
  local target="$2"

  sed \
    -e "s/__APP_DOMAIN__/$(escape_sed "$APP_DOMAIN")/g" \
    -e "s/__WEB_ROOT__/$(escape_sed "$WEB_ROOT")/g" \
    -e "s/__REMOTE_APP_DIR__/$(escape_sed "$REMOTE_APP_DIR")/g" \
    -e "s/__DATA_DIR__/$(escape_sed "$DATA_DIR")/g" \
    -e "s/__AUTH_PORT__/$(escape_sed "$AUTH_PORT")/g" \
    -e "s/__API_PORT__/$(escape_sed "$API_PORT")/g" \
    -e "s/__NGINX_HTTP_PORT__/$(escape_sed "$NGINX_HTTP_PORT")/g" \
    -e "s/__NODE_BIN__/$(escape_sed "$NODE_BIN")/g" \
    "$source" > "$target"
}

require_command npm
require_command npx
require_command rsync
require_command "${SSH_CMD[0]}"
require_command "${SCP_CMD[0]}"

echo "Building Expo web app for $PUBLIC_ORIGIN"
rm -rf "$BUILD_DIR"
npx expo export --platform web --output-dir "$BUILD_DIR" --clear

if [[ "$INSTALL_DEPS" == "1" ]]; then
  echo "Installing host packages on $SSH_TARGET"
  "${SSH_CMD[@]}" "$SSH_TARGET" "apt-get update && apt-get install -y nginx rsync"
fi

if [[ "$DISABLE_CADDY" == "1" ]]; then
  echo "Disabling Caddy so nginx can own ports 80/443"
  "${SSH_CMD[@]}" "$SSH_TARGET" "systemctl disable --now caddy 2>/dev/null || true"
fi

echo "Preparing remote directories"
"${SSH_CMD[@]}" "$SSH_TARGET" "mkdir -p '$REMOTE_APP_DIR/server' '$WEB_ROOT' '$DATA_DIR'"

echo "Uploading web build"
rsync -az --delete -e "${RSYNC_SSH_CMD[*]}" "$BUILD_DIR"/ "$SSH_TARGET:$WEB_ROOT"/

echo "Uploading Node servers"
rsync -az --delete -e "${RSYNC_SSH_CMD[*]}" server/ "$SSH_TARGET:$REMOTE_APP_DIR/server"/

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

render_template deploy/nginx/stack.conf.template "$tmp_dir/stack.conf"
render_template deploy/systemd/stack-auth.service.template "$tmp_dir/stack-auth.service"
render_template deploy/systemd/stack-api.service.template "$tmp_dir/stack-api.service"

echo "Installing nginx and systemd config"
"${SCP_CMD[@]}" "$tmp_dir/stack.conf" "$SSH_TARGET:/etc/nginx/sites-available/stack"
"${SCP_CMD[@]}" "$tmp_dir/stack-auth.service" "$SSH_TARGET:/etc/systemd/system/stack-auth.service"
"${SCP_CMD[@]}" "$tmp_dir/stack-api.service" "$SSH_TARGET:/etc/systemd/system/stack-api.service"

"${SSH_CMD[@]}" "$SSH_TARGET" "
  set -e
  ln -sf /etc/nginx/sites-available/stack /etc/nginx/sites-enabled/stack
  systemctl daemon-reload
  systemctl enable stack-auth stack-api
  systemctl restart stack-auth stack-api
  nginx -t
  systemctl enable nginx
  if systemctl is-active --quiet nginx; then
    systemctl reload nginx
  else
    systemctl start nginx
  fi
"

echo "Deployment complete: $PUBLIC_ORIGIN"
echo "Health checks:"
echo "  ssh $SSH_TARGET 'systemctl status stack-auth stack-api --no-pager'"
echo "  curl $PUBLIC_ORIGIN/auth/health"
echo "  curl $PUBLIC_ORIGIN/api/health"
