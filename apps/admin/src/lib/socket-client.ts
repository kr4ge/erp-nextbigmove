import { io, Socket } from 'socket.io-client';

class WorkflowSocketManager {
  private socket: Socket | null = null;

  connect() {
    if (this.socket?.connected) {
      return this.socket;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

    const rawBase = process.env.NEXT_PUBLIC_API_URL || '';
    let origin = '';

    try {
      origin = new URL(rawBase).origin;
    } catch {
      origin = '';
    }

    if (!origin || origin === 'http:' || origin === 'https:') {
      if (typeof window !== 'undefined') {
        origin = window.location.origin.replace('://admin.', '://api.');
      } else {
        origin = 'http://localhost:3001';
      }
    }

    this.socket = io(`${origin}/workflows`, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    return this.socket;
  }
}

export const workflowSocket = new WorkflowSocketManager();
