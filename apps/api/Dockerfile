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
COPY . .
# Dummy database URL so Prisma generate does not fail at build time
ENV DATABASE_URL=postgresql://user:pass@localhost:5432/placeholder
RUN npm run prisma:generate --workspace=@erp/api
RUN npm run build --workspace=@erp/api

FROM node:18-alpine AS prod-deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json turbo.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
COPY apps/admin/package*.json apps/admin/
COPY packages ./packages
RUN npm ci --omit=dev

FROM node:18-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
EXPOSE 3001
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package*.json ./apps/api/
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
CMD ["node", "apps/api/dist/main.js"]
