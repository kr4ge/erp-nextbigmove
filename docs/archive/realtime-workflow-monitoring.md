# Real-Time Workflow Monitoring Plan

## Overview
Add WebSocket-based real-time monitoring to display live workflow execution progress, logs, and status updates in the UI without polling.

## Current State Analysis

### What Exists
- ✅ Bull queue processing workflow executions
- ✅ Database progress tracking (daysProcessed, metaFetched, posFetched)
- ✅ NestJS Logger for console logging
- ✅ WorkflowProcessorService with 8 logging points
- ✅ Frontend with Zustand state management
- ✅ Tenant isolation via CLS

### What's Missing
- ❌ No WebSocket infrastructure (backend or frontend)
- ❌ No real-time event emission from workflow processor
- ❌ No execution log database storage (logs are ephemeral)
- ❌ Frontend relies on REST polling only

---

## Recommended Approach

### Architecture: Socket.IO with Room-Based Subscriptions

**Why Socket.IO over native WebSockets:**
- Built-in reconnection handling
- Room-based broadcasting (perfect for tenant isolation)
- Fallback to HTTP long-polling
- NestJS first-class support
- Battle-tested in production

**Room Strategy:**
- `execution:{executionId}` - Subscribe to specific execution updates
- `tenant:{tenantId}` - Subscribe to all tenant executions (dashboard view)

---

## Implementation Plan

### Phase 1: Backend - WebSocket Gateway Setup

#### 1.1 Install Dependencies
```bash
cd apps/api
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
```

#### 1.2 Create WebSocket Gateway
**File:** `apps/api/src/modules/workflows/gateways/workflow-execution.gateway.ts`

```typescript
@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000' },
  namespace: '/workflows',
})
export class WorkflowExecutionGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly clsService: ClsService) {}

  // Authenticate JWT from handshake
  afterInit(server: Server) {
    server.use(async (socket, next) => {
      const token = socket.handshake.auth.token;
      // Verify JWT and set tenantId in socket.data
    });
  }

  // Join execution room
  @SubscribeMessage('subscribe:execution')
  async subscribeToExecution(client: Socket, executionId: string) {
    const tenantId = client.data.tenantId;
    // Verify execution belongs to tenant
    await client.join(`execution:${executionId}`);
  }

  // Emit events to execution room
  emitExecutionEvent(executionId: string, event: string, data: any) {
    this.server.to(`execution:${executionId}`).emit(event, data);
  }
}
```

#### 1.3 Update WorkflowProcessorService
**File:** `apps/api/src/modules/workflows/services/workflow-processor.service.ts`

Inject gateway and emit events at key points:

```typescript
constructor(
  // ... existing dependencies
  private readonly executionGateway: WorkflowExecutionGateway,
) {}

async processWorkflowExecution(executionId: string) {
  // Emit: execution started
  this.executionGateway.emitExecutionEvent(executionId, 'execution:started', {
    executionId,
    status: 'RUNNING',
    timestamp: new Date(),
  });

  // In the date processing loop
  for (const date of dates) {
    this.executionGateway.emitExecutionEvent(executionId, 'execution:progress', {
      executionId,
      event: 'processing_date',
      date,
      progress: { current: index + 1, total: dates.length },
      timestamp: new Date(),
    });

    // After Meta fetch
    this.executionGateway.emitExecutionEvent(executionId, 'execution:meta_fetched', {
      executionId,
      date,
      accountId,
      count: upserted,
      timestamp: new Date(),
    });

    // After POS fetch
    this.executionGateway.emitExecutionEvent(executionId, 'execution:pos_fetched', {
      executionId,
      date,
      shopId,
      count: upserted,
      timestamp: new Date(),
    });
  }

  // Emit: execution completed
  this.executionGateway.emitExecutionEvent(executionId, 'execution:completed', {
    executionId,
    status: 'COMPLETED',
    duration,
    timestamp: new Date(),
  });
}
```

#### 1.4 Register Gateway in Module
**File:** `apps/api/src/modules/workflows/workflow.module.ts`

```typescript
@Module({
  providers: [
    // ... existing providers
    WorkflowExecutionGateway,
  ],
  exports: [WorkflowService, WorkflowExecutionGateway],
})
```

---

### Phase 2: Backend - Execution Log Storage (Optional but Recommended)

#### 2.1 Add Database Model
**File:** `apps/api/prisma/schema.prisma`

```prisma
model WorkflowExecutionLog {
  id          String   @id @default(uuid()) @db.Uuid
  executionId String   @db.Uuid
  execution   WorkflowExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)
  tenantId    String   @db.Uuid
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  level       String   // 'info', 'warn', 'error'
  event       String   // 'processing_date', 'meta_fetched', etc.
  message     String
  metadata    Json     @default("{}")

  createdAt   DateTime @default(now())

  @@index([executionId, createdAt])
  @@index([tenantId, createdAt])
  @@map("workflow_execution_logs")
}
```

#### 2.2 Create Log Service
**File:** `apps/api/src/modules/workflows/services/workflow-log.service.ts`

```typescript
@Injectable()
export class WorkflowLogService {
  async createLog(data: {
    executionId: string;
    tenantId: string;
    level: string;
    event: string;
    message: string;
    metadata?: any;
  }) {
    return this.prisma.workflowExecutionLog.create({ data });
  }

  async getExecutionLogs(executionId: string, tenantId: string) {
    return this.prisma.workflowExecutionLog.findMany({
      where: { executionId, tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
```

#### 2.3 Dual Emit: WebSocket + Database
Update WorkflowProcessorService to both emit and log:

```typescript
private emitAndLog(executionId: string, event: string, data: any) {
  // Emit to WebSocket
  this.executionGateway.emitExecutionEvent(executionId, event, data);

  // Persist to database
  this.workflowLogService.createLog({
    executionId,
    tenantId: this.clsService.get('tenantId'),
    level: 'info',
    event,
    message: this.formatLogMessage(event, data),
    metadata: data,
  });
}
```

---

### Phase 3: Frontend - WebSocket Client Setup

#### 3.1 Install Dependencies
```bash
cd apps/web
npm install socket.io-client
```

#### 3.2 Create Socket Manager
**File:** `apps/web/src/lib/socket-client.ts`

```typescript
import { io, Socket } from 'socket.io-client';

class WorkflowSocketManager {
  private socket: Socket | null = null;

  connect() {
    const token = localStorage.getItem('access_token');

    this.socket = io('http://localhost:3001/workflows', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('Connected to workflow monitoring');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from workflow monitoring');
    });

    return this.socket;
  }

  subscribeToExecution(executionId: string) {
    this.socket?.emit('subscribe:execution', executionId);
  }

  disconnect() {
    this.socket?.disconnect();
  }

  getSocket() {
    return this.socket;
  }
}

export const workflowSocket = new WorkflowSocketManager();
```

#### 3.3 Create Zustand Store
**File:** `apps/web/src/stores/workflow-execution-store.ts`

```typescript
import { create } from 'zustand';

interface ExecutionEvent {
  timestamp: Date;
  event: string;
  data: any;
}

interface ExecutionState {
  executionId: string | null;
  status: string;
  progress: { current: number; total: number };
  metaFetched: number;
  posFetched: number;
  events: ExecutionEvent[];
  isLive: boolean;
}

interface ExecutionStore {
  executions: Record<string, ExecutionState>;
  setExecution: (executionId: string, data: Partial<ExecutionState>) => void;
  addEvent: (executionId: string, event: ExecutionEvent) => void;
  clearExecution: (executionId: string) => void;
}

export const useExecutionStore = create<ExecutionStore>((set) => ({
  executions: {},

  setExecution: (executionId, data) =>
    set((state) => ({
      executions: {
        ...state.executions,
        [executionId]: { ...state.executions[executionId], ...data },
      },
    })),

  addEvent: (executionId, event) =>
    set((state) => ({
      executions: {
        ...state.executions,
        [executionId]: {
          ...state.executions[executionId],
          events: [...(state.executions[executionId]?.events || []), event],
        },
      },
    })),

  clearExecution: (executionId) =>
    set((state) => {
      const { [executionId]: _, ...rest } = state.executions;
      return { executions: rest };
    }),
}));
```

#### 3.4 Create Custom Hook
**File:** `apps/web/src/hooks/use-workflow-execution.ts`

```typescript
import { useEffect } from 'react';
import { workflowSocket } from '@/lib/socket-client';
import { useExecutionStore } from '@/stores/workflow-execution-store';

export function useWorkflowExecution(executionId: string) {
  const execution = useExecutionStore((state) => state.executions[executionId]);
  const setExecution = useExecutionStore((state) => state.setExecution);
  const addEvent = useExecutionStore((state) => state.addEvent);

  useEffect(() => {
    const socket = workflowSocket.connect();

    // Subscribe to execution updates
    workflowSocket.subscribeToExecution(executionId);

    // Listen to events
    socket.on('execution:started', (data) => {
      setExecution(executionId, { status: 'RUNNING', isLive: true });
      addEvent(executionId, { timestamp: new Date(), event: 'started', data });
    });

    socket.on('execution:progress', (data) => {
      setExecution(executionId, { progress: data.progress });
      addEvent(executionId, { timestamp: new Date(), event: 'progress', data });
    });

    socket.on('execution:meta_fetched', (data) => {
      setExecution(executionId, {
        metaFetched: (execution?.metaFetched || 0) + data.count
      });
      addEvent(executionId, { timestamp: new Date(), event: 'meta_fetched', data });
    });

    socket.on('execution:pos_fetched', (data) => {
      setExecution(executionId, {
        posFetched: (execution?.posFetched || 0) + data.count
      });
      addEvent(executionId, { timestamp: new Date(), event: 'pos_fetched', data });
    });

    socket.on('execution:completed', (data) => {
      setExecution(executionId, { status: 'COMPLETED', isLive: false });
      addEvent(executionId, { timestamp: new Date(), event: 'completed', data });
    });

    socket.on('execution:failed', (data) => {
      setExecution(executionId, { status: 'FAILED', isLive: false });
      addEvent(executionId, { timestamp: new Date(), event: 'failed', data });
    });

    return () => {
      workflowSocket.disconnect();
    };
  }, [executionId]);

  return execution;
}
```

---

### Phase 4: Frontend - Real-Time UI Components

#### 4.1 Live Execution Monitor Component
**File:** `apps/web/src/components/workflows/live-execution-monitor.tsx`

```typescript
'use client';

import { useWorkflowExecution } from '@/hooks/use-workflow-execution';

export function LiveExecutionMonitor({ executionId }: { executionId: string }) {
  const execution = useWorkflowExecution(executionId);

  if (!execution) {
    return <div>Loading execution...</div>;
  }

  const progressPercent = execution.progress
    ? (execution.progress.current / execution.progress.total) * 100
    : 0;

  return (
    <div className="space-y-4">
      {/* Status Badge */}
      <div className="flex items-center gap-2">
        {execution.isLive && (
          <span className="flex items-center gap-2 text-sm text-blue-600">
            <span className="animate-pulse h-2 w-2 rounded-full bg-blue-600"></span>
            LIVE
          </span>
        )}
        <span className="font-semibold">{execution.status}</span>
      </div>

      {/* Progress Bar */}
      {execution.progress && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Processing {execution.progress.current} of {execution.progress.total} days</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Counters */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="text-sm text-slate-600">Meta Insights</div>
          <div className="text-2xl font-bold text-slate-900">{execution.metaFetched || 0}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="text-sm text-slate-600">POS Orders</div>
          <div className="text-2xl font-bold text-slate-900">{execution.posFetched || 0}</div>
        </div>
      </div>

      {/* Live Event Log */}
      <div className="bg-slate-50 rounded-lg p-4 max-h-96 overflow-y-auto">
        <h3 className="font-semibold mb-2">Live Logs</h3>
        <div className="space-y-1 text-sm font-mono">
          {execution.events?.map((event, i) => (
            <div key={i} className="text-slate-700">
              <span className="text-slate-400">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>{' '}
              {event.event}: {JSON.stringify(event.data, null, 2)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

#### 4.2 Update Execution Detail Page
**File:** `apps/web/src/app/(dashboard)/workflows/[id]/executions/[executionId]/page.tsx`

```typescript
import { LiveExecutionMonitor } from '@/components/workflows/live-execution-monitor';

export default function ExecutionDetailPage({ params }) {
  const { executionId } = params;

  return (
    <div className="space-y-6">
      <h1>Execution Details</h1>

      {/* Real-time monitor */}
      <LiveExecutionMonitor executionId={executionId} />

      {/* Static execution details below */}
    </div>
  );
}
```

---

## Event Types Reference

### Backend Events (Emitted)

| Event | Payload | When |
|-------|---------|------|
| `execution:started` | `{ executionId, status, timestamp }` | Execution begins |
| `execution:progress` | `{ executionId, date, progress: { current, total }, timestamp }` | Each date processed |
| `execution:meta_fetched` | `{ executionId, date, accountId, count, timestamp }` | After Meta API fetch |
| `execution:pos_fetched` | `{ executionId, date, shopId, count, timestamp }` | After POS API fetch |
| `execution:completed` | `{ executionId, status, duration, timestamp }` | Execution succeeds |
| `execution:failed` | `{ executionId, status, error, timestamp }` | Execution fails |

### Frontend Events (Subscribed)

| Action | Payload | Purpose |
|--------|---------|---------|
| `subscribe:execution` | `executionId` | Join execution room |
| `unsubscribe:execution` | `executionId` | Leave execution room |

---

## Security Considerations

1. **JWT Authentication**: Verify tokens in WebSocket handshake
2. **Tenant Isolation**: Check execution belongs to tenant before joining room
3. **CORS**: Configure allowed origins for Socket.IO
4. **Rate Limiting**: Prevent WebSocket abuse
5. **Cleanup**: Auto-disconnect inactive clients

---

## Rollout Strategy

### Phase 1: Core Infrastructure (IMPLEMENTING THIS)
**Focus:** Real-time workflow progress and API fetching logs
- ✅ WebSocket gateway with JWT auth
- ✅ Event emission from processor (8 logging points)
- ✅ Frontend socket client
- ✅ Basic live monitoring UI with:
  - Live progress bar
  - Meta/POS fetch counters
  - Real-time event log display
  - LIVE indicator badge

### Phase 2: Enhanced Features (Future - Real-time Data Analytics)
- Database log storage (WorkflowExecutionLog model)
- Historical log viewing
- Multi-execution dashboard
- Notification system
- Advanced analytics dashboards

### Phase 3: Production Hardening (Future)
- Redis adapter for horizontal scaling
- WebSocket health checks
- Error retry logic
- Performance monitoring

---

## Testing Checklist

- [ ] WebSocket connection with JWT auth
- [ ] Tenant isolation (user A can't see user B's executions)
- [ ] Real-time progress updates
- [ ] Event log accuracy
- [ ] Reconnection after network failure
- [ ] Multiple concurrent executions
- [ ] Browser tab close cleanup

---

## Files to Create/Modify

### Backend
**Create:**
- `apps/api/src/modules/workflows/gateways/workflow-execution.gateway.ts`
- `apps/api/src/modules/workflows/services/workflow-log.service.ts` (optional)

**Modify:**
- `apps/api/src/modules/workflows/services/workflow-processor.service.ts` (add event emissions)
- `apps/api/src/modules/workflows/workflow.module.ts` (register gateway)
- `apps/api/package.json` (add dependencies)
- `apps/api/prisma/schema.prisma` (optional log model)

### Frontend
**Create:**
- `apps/web/src/lib/socket-client.ts`
- `apps/web/src/stores/workflow-execution-store.ts`
- `apps/web/src/hooks/use-workflow-execution.ts`
- `apps/web/src/components/workflows/live-execution-monitor.tsx`
- `apps/web/src/app/(dashboard)/workflows/[id]/executions/[executionId]/page.tsx`

**Modify:**
- `apps/web/package.json` (add socket.io-client)

---

## Implementation Summary

### What We're Building (Phase 1)
Real-time workflow monitoring that displays:
- **Live progress bar** showing "Processing X of Y days"
- **Meta/POS counters** incrementing in real-time
- **Live event log** with timestamps showing API fetching activity
- **LIVE badge** indicating active execution

### Key Features
1. **WebSocket-based** - No polling, instant updates
2. **Room subscriptions** - Clients subscribe to specific execution rooms
3. **Event-driven** - 6 event types (started, progress, meta_fetched, pos_fetched, completed, failed)
4. **Tenant-isolated** - JWT auth ensures users only see their executions
5. **Future-ready** - Foundation for real-time data analytics

### Implementation Order
1. Backend WebSocket gateway with auth
2. Event emission from workflow processor
3. Frontend Socket.IO client
4. Zustand store for real-time state
5. Live monitoring UI component

### Database Log Storage - SKIPPED FOR PHASE 1
Per user's request to focus on real-time monitoring, we'll skip database log persistence for now. Logs will be ephemeral (in-memory only during execution). This can be added later in Phase 2 for historical log viewing and analytics.

## Estimated Effort
- Backend: 3-4 hours
- Frontend: 2-3 hours
- Testing: 1-2 hours
- **Total: 6-9 hours**

---

## Alternative Approaches Considered

### 1. Server-Sent Events (SSE)
**Pros:** Simpler, HTTP-based, native browser support
**Cons:** Unidirectional only, no room-based broadcasting
**Verdict:** ❌ Not suitable for bidirectional real-time communication

### 2. GraphQL Subscriptions
**Pros:** Type-safe, fits GraphQL ecosystem
**Cons:** Adds complexity, requires Apollo setup
**Verdict:** ❌ Overkill for this use case

### 3. REST Polling
**Pros:** Simple, no new infrastructure
**Cons:** Inefficient, delays in updates, server load
**Verdict:** ❌ Current approach, defeats purpose of real-time monitoring

### 4. Socket.IO (Recommended)
**Pros:** Battle-tested, room-based, auto-reconnect, NestJS support
**Cons:** Slight overhead vs native WebSockets
**Verdict:** ✅ **Best fit for requirements**
