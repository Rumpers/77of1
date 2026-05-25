FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests for dependency resolution
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY artifacts/admin/package.json ./artifacts/admin/package.json
COPY lib/admin-sdk/package.json ./lib/admin-sdk/package.json

# Install dependencies (workspace-aware)
RUN pnpm install --frozen-lockfile --filter @workspace/admin --filter @7of1/admin-sdk

# Copy source
COPY artifacts/admin/ ./artifacts/admin/
COPY lib/admin-sdk/ ./lib/admin-sdk/

WORKDIR /app/artifacts/admin

# Build Next.js (standalone output)
RUN pnpm build

# ─── Runtime stage ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=base /app/artifacts/admin/.next/standalone ./
COPY --from=base /app/artifacts/admin/.next/static ./artifacts/admin/.next/static
COPY --from=base /app/artifacts/admin/public ./artifacts/admin/public 2>/dev/null || true

EXPOSE 8080

CMD ["node", "artifacts/admin/server.js"]
