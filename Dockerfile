# ============================================================
# Project Golem — Zeabur Single-Agent Deployment
# Base: Playwright Noble (Ubuntu 24.04, GLIBC 2.39+)
# ============================================================

# --- Stage 1: Builder ---
FROM mcr.microsoft.com/playwright:v1.50.0-noble AS builder

WORKDIR /app

# 安裝 root 依賴
COPY package*.json ./
RUN npm install

# 下載 Chromium（指定路徑）
ENV PLAYWRIGHT_BROWSERS_PATH=/app/pw-browsers
RUN npx playwright install chromium --with-deps

# 安裝並 build web-dashboard
COPY web-dashboard/package*.json ./web-dashboard/
WORKDIR /app/web-dashboard
RUN NODE_ENV=development npm install

WORKDIR /app
COPY . .
RUN npm run build

# --- Stage 2: Runner ---
FROM mcr.microsoft.com/playwright:v1.50.0-noble AS runner

# 環境變數
ENV PLAYWRIGHT_BROWSERS_PATH=/app/pw-browsers \
    NODE_ENV=production \
    # Zeabur 上強制 headless，不需要虛擬桌面
    PLAYWRIGHT_HEADLESS=true \
    GOLEM_DESKTOP_MODE=false \
    # 關閉 Next.js 遙測
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# 複製依賴與 build 產物
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/pw-browsers ./pw-browsers
COPY --from=builder /app/web-dashboard/.next ./web-dashboard/.next
COPY --from=builder /app/web-dashboard/out ./web-dashboard/out
COPY --from=builder /app/web-dashboard/public ./web-dashboard/public
COPY --from=builder /app/web-dashboard/server.js ./web-dashboard/server.js
COPY --from=builder /app/web-dashboard/node_modules ./web-dashboard/node_modules
COPY package*.json ./
COPY web-dashboard/package*.json ./web-dashboard/

# 複製所有原始碼
COPY . .

# entrypoint
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 建立資料目錄（golem_memory 和 logs）
# 注意：如果 Zeabur 有掛 PVC，這裡只是 fallback
RUN mkdir -p /app/golem_memory /app/logs

# ⚠️ 不用 USER ubuntu — Zeabur k3s 環境以 root 跑容器，指定非root user 會導致權限錯誤
# 如果你未來需要安全加固再打開

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "dashboard"]
