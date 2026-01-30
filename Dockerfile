FROM node:20-alpine AS base

# Create app directory
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

# Set a dummy database URL for the build process (Prisma generation needs it defined)
ENV DATABASE_URL="file:./dev.db"

# Generate Prisma Client
# Prisma generation is now handled by npm run build

# Build Next.js app
RUN npm run build

# Bundle worker script
# We use esbuild to bundle the worker and its local dependencies (like src/lib) into a single file
# while keeping node_modules external.
RUN npm install -g esbuild && esbuild scripts/worker.ts --bundle --platform=node --external:@prisma/client --outfile=.next/standalone/worker.js

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/app/data/db.sqlite"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install OpenSSL for Prisma and Prisma CLI
RUN apk add --no-cache openssl
RUN npm install prisma@6.19.0 dotenv

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy prisma directory for migrations
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Create folder for scan history persistence and data
RUN mkdir -p .scan_history && chown nextjs:nodejs .scan_history
RUN mkdir -p data && chown nextjs:nodejs data

# Copy entrypoint script
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Ensure .app_settings.json exists and is writable
COPY --from=builder --chown=nextjs:nodejs /app/.app_settings.template.json ./.app_settings.template.json
RUN cp .app_settings.template.json .app_settings.json && chown nextjs:nodejs .app_settings.json

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./docker-entrypoint.sh"]