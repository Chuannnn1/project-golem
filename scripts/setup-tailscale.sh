#!/bin/sh
set -e

TAILSCALE_DIR="$HOME/.tailscale"
mkdir -p "$TAILSCALE_DIR"

# 安裝 Tailscale（如果還沒裝）
if ! command -v tailscaled > /dev/null 2>&1; then
    echo "[tailscale] Installing Tailscale..."
    curl -fsSL https://tailscale.com/install.sh | sh
fi

# 啟動 tailscaled daemon
if ! pgrep -x tailscaled > /dev/null 2>&1; then
    echo "[tailscale] Starting tailscaled..."
    tailscaled \
        --state="$TAILSCALE_DIR/tailscaled.state" \
        --socket="$TAILSCALE_DIR/tailscaled.sock" \
        > "$TAILSCALE_DIR/tailscaled.log" 2>&1 &
    sleep 3
fi

# Symlink socket 到預設路徑
mkdir -p /var/run/tailscale
ln -sf "$TAILSCALE_DIR/tailscaled.sock" /var/run/tailscale/tailscaled.sock

# 認證（用環境變數 TAILSCALE_AUTH_KEY）
if [ -n "${TAILSCALE_AUTH_KEY:-}" ]; then
    echo "[tailscale] Authenticating..."
    tailscale up \
        --authkey="$TAILSCALE_AUTH_KEY" \
        --hostname="${TAILSCALE_HOSTNAME:-golem-zeabur}" \
        --accept-routes \
        --socket="$TAILSCALE_DIR/tailscaled.sock"
else
    echo "[tailscale] WARNING: TAILSCALE_AUTH_KEY not set, skipping auth."
fi

# 把 Golem dashboard port 3000 暴露到 Tailscale 網路
echo "[tailscale] Serving dashboard on Tailscale https:443 -> localhost:3000"
tailscale serve \
    --socket="$TAILSCALE_DIR/tailscaled.sock" \
    --bg \
    --https=443 \
    http://127.0.0.1:3000

echo "[tailscale] Setup complete."
