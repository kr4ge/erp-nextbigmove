# Multi-Tenant ERP Analytics SaaS Platform

A production-ready, multi-tenant ERP analytics platform built with NestJS, Next.js, PostgreSQL, and Prisma. Designed for scalability and security with row-level tenant isolation.

## Architecture Overview

- **Multi-Tenancy**: Row-level isolation with single PostgreSQL database
- **Authentication**: JWT-based with tenant context
- **Security**: Row-Level Security (RLS), AES-256-GCM encryption, CORS, rate limiting
- **Scalability**: Designed for high-volume data from POS and Meta API integrations

## Technology Stack

### Backend (API)
- NestJS 10+ (Node.js framework)
- Prisma ORM with PostgreSQL
- JWT authentication with Passport.js
- Bull + Redis (queue system)
- nestjs-cls (AsyncLocalStorage for tenant context)

### Frontend
- Next.js 14+ (App Router)
- TailwindCSS
- TanStack Query (React Query)
- Zustand (state management)
- React Hook Form + Zod

### Infrastructure
- PostgreSQL 15+
- Redis 7+
- Docker + Docker Compose
- DigitalOcean deployment ready

## Project Structure

```
ERP-System/
├── apps/
│   ├── api/                    # NestJS Backend
│   ├── web/                    # Next.js Tenant App
│   └── admin/                  # Next.js Admin Dashboard
├── packages/
│   ├── types/                  # Shared TypeScript types
│   ├── typescript-config/      # Shared tsconfig
│   └── eslint-config/          # Shared ESLint config
├── docker/                     # Docker configuration
├── docker-compose.dev.yml      # Development environment
├── docker-compose.prod.yml     # Production environment
└── turbo.json                  # Turborepo configuration
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Docker and Docker Compose
- PostgreSQL 15+ (or use Docker)

### Installation

1. **Clone the repository**
   ```bash
   cd /Users/frage.ai/dev/ERP-System
   ```

2. **Copy environment variables**
   ```bash
   cp .env.example .env
   ```

3. **Update `.env` with your configuration**
   - Generate secure JWT secrets (min 64 characters)
   - Update database credentials if needed

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Start Docker services**
   ```bash
   npm run docker:dev
   ```

6. **Copy .env to apps/api (required for Prisma)**
   ```bash
   cp .env apps/api/.env
   ```

7. **Generate Prisma client and run migrations**
   ```bash
   npm run api:migrate
   ```

8. **Start development servers**
   ```bash
   npm run dev
   ```

This will start:
- API: http://localhost:3001
- Web App: http://localhost:3000
- Admin Dashboard: http://localhost:3002

## Development Workflow

### Running Individual Apps

```bash
# API only
cd apps/api
npm run dev

# Web app only
cd apps/web
npm run dev

# Admin dashboard only
cd apps/admin
npm run dev
```

### Database Management

```bash
# Create a new migration
npm run api:migrate

# Open Prisma Studio
npm run api:studio

# Deploy migrations (production)
cd apps/api
npx prisma migrate deploy
```

### Docker Commands

```bash
# Start development environment
npm run docker:dev

# Stop services
npm run docker:down

# Start production environment
npm run docker:prod

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

## Database Schema

### Tenant Isolation Strategy

- **Row-Level Security**: Every tenant-scoped table has a `tenantId` column
- **Automatic Filtering**: Prisma Client Extensions filter queries by tenant
- **Global Tables**: `tenants` table has no `tenantId` (manages all tenants)

### Core Models

- **Tenant**: Organization/company using the platform
- **User**: Users belonging to a tenant (RBAC with roles)
- **Integration**: Data source integrations (POS, Meta Ads, etc.)
- **AnalyticsEvent**: Analytics events and metrics
- **AuditLog**: Audit trail for compliance

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new tenant + admin user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh access token

### Users (Protected)
- `GET /api/v1/users/me` - Get current user
- `GET /api/v1/users` - List users (tenant-scoped)
- `POST /api/v1/users` - Create user (admin only)

### Integrations (Protected)
- `GET /api/v1/integrations` - List integrations (tenant-scoped)
- `POST /api/v1/integrations` - Create integration
- `PUT /api/v1/integrations/:id` - Update integration

## Environment Variables

Key environment variables in `.env`:

```bash
# Database
DATABASE_URL="postgresql://erp_user:dev_password@localhost:5432/erp_analytics?schema=public"

# JWT (MUST change in production)
JWT_SECRET="your-super-secret-jwt-key-min-64-chars"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-min-64-chars"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# API URL for frontend
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

## Security Features

✅ JWT authentication with short-lived tokens
✅ Row-Level Security (RLS) on PostgreSQL
✅ Per-tenant encryption keys for credentials
✅ CORS with specific origins
✅ Rate limiting (100 requests/minute)
✅ Input validation on all endpoints
✅ Audit logging for sensitive operations
✅ Helmet.js security headers

## Roadmap

### Phase 1: Foundation ✅ (Current)
- Monorepo setup
- Docker environment
- NestJS API skeleton
- Next.js web and admin apps
- Prisma schema with multi-tenancy

### Phase 2: Authentication & Tenant Management (Next)
- Complete auth flow (register, login, refresh)
- Tenant management
- User RBAC
- Tenant context middleware

### Phase 3: Integration Framework
- Base integration providers
- Credential encryption
- Mock integrations for testing

### Phase 4: Analytics Framework
- Data models for analytics
- Mock dashboard
- Basic charts and metrics

### Phase 5: Core Platform Features
- User management UI
- Tenant settings
- Admin dashboard basics

## Scripts

```bash
# Development
npm run dev              # Start all apps in development mode
npm run build            # Build all apps
npm run lint             # Lint all apps

# Docker
npm run docker:dev       # Start development Docker services
npm run docker:prod      # Start production Docker services
npm run docker:down      # Stop Docker services

# Database
npm run api:migrate      # Run Prisma migrations
npm run api:studio       # Open Prisma Studio

# Clean
npm run clean            # Clean all build artifacts
```

## Deployment

### DigitalOcean Deployment

1. Create a Droplet (Ubuntu 22.04 LTS)
2. Install Docker and Docker Compose
3. Clone repository
4. Set production environment variables
5. Run: `npm run docker:prod`

Detailed deployment guide: See [DEPLOYMENT.md](./DEPLOYMENT.md) (coming soon)

## License

MIT

## Documentation

📚 **[Full Documentation](./docs/)** - Comprehensive guides and references

**Quick Links:**
- [Team Isolation Feature](./docs/team-isolation/) - Team-based data isolation
- [Quick Start Guide](./docs/team-isolation/QUICK_START.md) - Get started testing
- [Testing Guide](./docs/team-isolation/TESTING_GUIDE.md) - How to test features

## Recent Features

### ✅ Team-Based Data Isolation (January 2026)
Complete team-based access control ensuring users can only access data from teams they belong to.

**Documentation:**
- [Quick Start](./docs/team-isolation/QUICK_START.md)
- [Full Documentation](./docs/team-isolation/)

**Key Features:**
- Row-level team filtering on all resources
- API endpoint: `GET /api/v1/teams/my-teams`
- Multi-team support for users
- Tenant admin override capability

## Support

For issues and questions:
- GitHub Issues: [Create an issue](#)
- Documentation: [View docs](./docs/)
