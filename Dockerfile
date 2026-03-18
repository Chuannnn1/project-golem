# Base image with Node.js 20 (Slim version for smaller size & multi-arch support)
FROM node:20-slim

# Install system dependencies for Puppeteer (Chromium) + curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    curl \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Skip downloading Chrome and use installed Chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true \
    PLAYWRIGHT_BROWSERS_PATH=/usr/bin/chromium \
    NEXT_TELEMETRY_DISABLED=1

# --- Layer caching: install deps before copying source ---

# 1. Root dependencies (changes rarely)
COPY package*.json ./
RUN npm ci --omit=dev

# 2. Web dashboard dependencies (changes rarely)
COPY web-dashboard/package*.json ./web-dashboard/
WORKDIR /app/web-dashboard
RUN npm ci

# 3. Web dashboard source + build
COPY web-dashboard/ ./
RUN npm run build

# 4. Copy application source (changes most often — last layer)
WORKDIR /app
COPY . .

# Expose the dashboard port
EXPOSE 3000

# Health check for Docker and orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application in dashboard mode
CMD ["npm", "run", "dashboard"]
