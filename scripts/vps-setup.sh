#!/usr/bin/env bash
set -euo pipefail

# Freezeflow VPS setup: installs Docker + Tailscale, clones this repo using
# a deploy key, and starts the stack. Run as root (or with sudo) on a fresh
# Ubuntu 24.04 server. This is step 3 of the runbook in docs/deployment.md
# ("Recommended: a small VPS + Tailscale") - read that first.

REPO_URL="git@github.com:christinehatch/freezeflow.git"
INSTALL_DIR="/opt/freezeflow"
DEPLOY_KEY_PATH="$HOME/.ssh/freezeflow-deploy-key"

echo "==> Installing Docker"
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

echo "==> Installing Tailscale"
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up

echo "==> Setting up the deploy key for GitHub access"
if [ ! -f "$DEPLOY_KEY_PATH" ]; then
  echo "Deploy key not found at $DEPLOY_KEY_PATH."
  echo "Copy your freezeflow-deploy-key there first (scp it from your own machine), then re-run this script."
  exit 1
fi
chmod 600 "$DEPLOY_KEY_PATH"
eval "$(ssh-agent -s)"
ssh-add "$DEPLOY_KEY_PATH"
mkdir -p "$HOME/.ssh"
ssh-keyscan -H github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null

echo "==> Cloning the repo"
if [ -d "$INSTALL_DIR" ]; then
  echo "$INSTALL_DIR already exists, pulling latest instead of cloning."
  git -C "$INSTALL_DIR" pull
else
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "==> Created .env from .env.example - you still need to set FREEZEFLOW_CORS_ALLOWED_ORIGINS (see docs/deployment.md step 4) before this is usable."
fi

echo "==> Building and starting the stack"
docker compose up --build -d

cat <<'EOF'

==> Done. Next:
  1. sudo tailscale serve --bg 8080
  2. Note the https://<name>.<tailnet>.ts.net hostname it prints
  3. Set FREEZEFLOW_CORS_ALLOWED_ORIGINS in .env to that same https:// origin
  4. docker compose up -d

See docs/deployment.md for the full runbook, including backups.
EOF
