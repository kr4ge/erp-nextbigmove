import { io, Socket } from 'socket.io-client';

class WorkflowSocketManager {
  private socket: Socket | null = null;

  connect() {
    if (this.socket?.connected) return this.socket;

    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

    const rawBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    // Strip any /api... suffix so we hit the websocket namespace at the server root
    const baseUrl = rawBase.replace(/\/api.*$/, '').replace(/\/$/, '');
    const socketUrl = `${baseUrl}/workflows`;

    this.socket = io(socketUrl, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    return this.socket;
  }

  subscribeToExecution(executionId: string) {
    this.socket?.emit('subscribe:execution', executionId);
  }

  subscribeToTenant(tenantId: string, teamId?: string | null) {
    if (!tenantId) return;
    this.socket?.emit('subscribe:tenant', { tenantId, teamId: teamId || null });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const workflowSocket = new WorkflowSocketManager();
