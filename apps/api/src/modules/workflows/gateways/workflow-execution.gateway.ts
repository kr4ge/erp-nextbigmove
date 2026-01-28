import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/workflows',
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  },
})
export class WorkflowExecutionGateway {
  @WebSocketServer()
  server: Server;

  /**
   * Subscribe a client to tenant/team room for broadcast updates
   */
  @SubscribeMessage('subscribe:tenant')
  handleSubscribeTenant(
    @MessageBody() data: { tenantId: string; teamId?: string | null },
    @ConnectedSocket() client: Socket,
  ) {
    const tenantId = data?.tenantId;
    const teamId = data?.teamId;
    if (tenantId) {
      client.join(`tenant:${tenantId}`);
      if (teamId) {
        client.join(`tenant:${tenantId}:team:${teamId}`);
      }
    }
  }

  /**
   * Subscribe a client to an execution room
   */
  @SubscribeMessage('subscribe:execution')
  handleSubscribe(
    @MessageBody() executionId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (executionId) {
      client.join(`execution:${executionId}`);
    }
  }

  /**
   * Emit an event to all subscribers of an execution
   */
  emitExecutionEvent(executionId: string, event: string, payload: any) {
    if (!this.server) return;
    this.server.to(`execution:${executionId}`).emit(event, payload);
  }

  /**
   * Emit an event to all subscribers of a tenant/team
   */
  emitTenantEvent(tenantId: string, teamId: string | null | undefined, event: string, payload: any) {
    if (!this.server) return;
    this.server.to(`tenant:${tenantId}`).emit(event, payload);
    if (teamId) {
      this.server.to(`tenant:${tenantId}:team:${teamId}`).emit(event, payload);
    }
  }
}
