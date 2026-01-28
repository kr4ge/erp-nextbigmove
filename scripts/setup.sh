#!/bin/bash

# ERP Analytics Platform - Setup Script
# This script sets up the development environment

set -e

echo "🚀 ERP Analytics Platform - Setup"
echo "=================================="
echo ""

# Check if .env exists in root
if [ ! -f ".env" ]; then
  echo "❌ Error: .env file not found in root directory"
  echo "   Please copy .env.example to .env and configure it"
  exit 1
fi

echo "✅ Found .env in root directory"

# Copy .env to apps/api for Prisma
echo "📋 Copying .env to apps/api for Prisma..."
cp .env apps/api/.env
echo "✅ .env copied to apps/api"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Error: Docker is not running"
  echo "   Please start Docker and try again"
  exit 1
fi

echo "✅ Docker is running"

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for PostgreSQL to be healthy
echo "⏳ Waiting for PostgreSQL to be ready..."
timeout=60
elapsed=0
until docker exec erp-postgres pg_isready -U erp_user > /dev/null 2>&1; do
  if [ $elapsed -ge $timeout ]; then
    echo "❌ Error: PostgreSQL failed to start within ${timeout} seconds"
    exit 1
  fi
  sleep 2
  elapsed=$((elapsed + 2))
  echo -n "."
done
echo ""
echo "✅ PostgreSQL is ready"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "📦 Installing npm dependencies..."
  npm install
  echo "✅ Dependencies installed"
else
  echo "✅ Dependencies already installed"
fi

# Run Prisma migrations
echo "🗄️  Running Prisma migrations..."
cd apps/api
npx prisma migrate dev --name init
npx prisma generate
cd ../..
echo "✅ Database migrations complete"

echo ""
echo "✨ Setup complete!"
echo ""
echo "🚀 Next steps:"
echo "   1. Run 'npm run dev' to start all services"
echo "   2. Access the applications:"
echo "      - API: http://localhost:3001/api/v1"
echo "      - Web App: http://localhost:3000"
echo "      - Admin Dashboard: http://localhost:3002"
echo "      - Prisma Studio: npm run api:studio"
echo ""
