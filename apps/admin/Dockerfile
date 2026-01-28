FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json turbo.json ./
COPY apps/admin/package*.json apps/admin/
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
COPY packages ./packages
RUN npm ci

FROM deps AS builder
WORKDIR /app
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build --workspace=@erp/admin

FROM node:18-alpine AS prod-deps
WORKDIR /app
COPY package*.json turbo.json ./
COPY apps/admin/package*.json apps/admin/
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
COPY packages ./packages
RUN npm ci --omit=dev

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3002
EXPOSE 3002
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/admin/.next ./apps/admin/.next
COPY --from=builder /app/apps/admin/public ./apps/admin/public
COPY --from=builder /app/apps/admin/package*.json ./apps/admin/
CMD ["npm", "run", "start", "--workspace=@erp/admin"]
