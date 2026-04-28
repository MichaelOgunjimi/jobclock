# syntax=docker/dockerfile:1.4

# ── Base ──────────────────────────────────────────────────────────────────────
# node:22-slim (Debian slim) is required — sparticuz/chromium ships a glibc
# binary that does NOT run on Alpine (musl libc).
FROM node:22-slim AS base
WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
# BuildKit cache mount keeps the npm cache between builds so reinstalls are fast
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ── Development ───────────────────────────────────────────────────────────────
FROM base AS dev
ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1
# Install system Chromium so PDF generation works on any host architecture
# (avoids @sparticuz/chromium's x86_64-only binary failing on ARM64 / Apple Silicon)
RUN apt-get update && apt-get install -y --no-install-recommends \
        chromium \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 3000
# Source code is bind-mounted by docker-compose; node_modules stay in the image
CMD ["node_modules/.bin/next", "dev", "--hostname", "0.0.0.0"]

# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Runner (self-hosted production) ───────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3300
CMD ["node", "server.js"]
