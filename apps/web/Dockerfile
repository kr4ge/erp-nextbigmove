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
COPY apps/web ./apps/web
COPY packages ./packages
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_TIMEZONE=Asia/Manila
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_TIMEZONE=$NEXT_PUBLIC_TIMEZONE
RUN npm run build --workspace=@erp/web

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Copy package files for workspace resolution
COPY package*.json turbo.json ./
COPY apps/web/package*.json apps/web/

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy built application
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public

CMD ["npm", "run", "start", "--workspace=@erp/web"]
