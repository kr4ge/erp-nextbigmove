FROM node:18-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json turbo.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
COPY apps/admin/package*.json apps/admin/
COPY packages ./packages
RUN npm ci

FROM deps AS builder
WORKDIR /app
COPY apps/api ./apps/api
COPY packages ./packages
# Dummy database URL so Prisma generate does not fail at build time
ENV DATABASE_URL=postgresql://user:pass@localhost:5432/placeholder
RUN npm run prisma:generate --workspace=@erp/api
RUN npm run build --workspace=@erp/api

FROM node:18-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
# Tell Prisma where to find the query engine (needed when using bundlers like esbuild/webpack)
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node
EXPOSE 3001

# Copy package files for workspace resolution
COPY package*.json turbo.json ./
COPY apps/api/package*.json apps/api/

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy Prisma generated client AND query engine from builder stage
# This overwrites the .prisma folder with the one that has the generated client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy built application and prisma schema
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

CMD ["node", "apps/api/dist/main.js"]
