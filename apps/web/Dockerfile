FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json turbo.json ./
COPY apps/web/package*.json apps/web/
COPY apps/api/package*.json apps/api/
COPY apps/admin/package*.json apps/admin/
COPY packages ./packages
RUN npm ci

FROM deps AS builder
WORKDIR /app
COPY . .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_TIMEZONE=UTC
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_TIMEZONE=$NEXT_PUBLIC_TIMEZONE
RUN npm run build --workspace=@erp/web

FROM node:18-alpine AS prod-deps
WORKDIR /app
COPY package*.json turbo.json ./
COPY apps/web/package*.json apps/web/
COPY apps/api/package*.json apps/api/
COPY apps/admin/package*.json apps/admin/
COPY packages ./packages
RUN npm ci --omit=dev

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package*.json ./apps/web/
CMD ["npm", "run", "start", "--workspace=@erp/web"]
