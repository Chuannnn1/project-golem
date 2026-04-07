# ============================================================
# Project Golem — Zeabur Single-Agent Deployment
# ============================================================

# --- Stage 1: Builder ---
FROM mcr.microsoft.com/playwright:v1.50.0-noble AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

ENV PLAYWRIGHT_BROWSERS_PATH=/app/pw-browsers
RUN npx playwright install chromium --with-deps

COPY web-dashboard/package*.json ./web-dashboard/
WORKDIR /app/web-dashboard
RUN NODE_ENV=development npm install

WORKDIR /app
COPY . .
RUN npm run build

# --- Stage 2: Runner ---
FROM mcr.microsoft.com/playwright:v1.50.0-noble AS runner

ENV PLAYWRIGHT_BROWSERS_PATH=/app/pw-browsers \
    NODE_ENV=production \
    PLAYWRIGHT_HEADLESS=true \
    GOLEM_DESKTOP_MODE=false \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/pw-browsers ./pw-browsers
COPY --from=builder /app/web-dashboard/.next ./web-dashboard/.next
COPY --from=builder /app/web-dashboard/out ./web-dashboard/out
COPY --from=builder /app/web-dashboard/public ./web-dashboard/public
COPY --from=builder /app/web-dashboard/server.js ./web-dashboard/server.js
COPY --from=builder /app/web-dashboard/node_modules ./web-dashboard/node_modules
COPY package*.json ./
COPY web-dashboard/package*.json ./web-dashboard/
COPY . .

# scripts
RUN cp /app/scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh /app/scripts/setup-tailscale.sh

RUN mkdir -p /app/golem_memory /app/logs /app/openclaw_ref

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "dashboard"]
