import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import WebSocket = require('ws');
import type { RawData } from 'ws';

export type ClaudeboxRunInput = {
  tenantId: string;
  userId: string;
  runId: string;
  workspace: string;
  prompt: string;
  provider: 'CLAUDE' | 'CODEX';
  model: string;
  effort: 'LOW' | 'MEDIUM' | 'HIGH' | 'XHIGH' | 'MAX';
  maxTurns: number;
  maxBudgetUsd: number;
  onDelta?: (text: string) => void;
};

export type ClaudeboxRunOutput = {
  result: string;
  responseText: string;
  sessionId: string | null;
  usage: unknown;
  totalCostUsd: number | null;
};

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'verdict', 'confidence', 'evidence', 'strengths', 'risks', 'recommendations', 'dataQuality'],
  properties: {
    summary: { type: 'string' },
    verdict: { type: 'string' },
    confidence: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['timestampSeconds', 'observation', 'metricConnection', 'evidenceType'],
        properties: {
          timestampSeconds: { type: ['number', 'null'] },
          observation: { type: 'string' },
          metricConnection: { type: 'string' },
          evidenceType: { type: 'string', enum: ['OBSERVED', 'MEASURED', 'HYPOTHESIS'] },
        },
      },
    },
    strengths: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['priority', 'action', 'rationale', 'hypothesis', 'test'],
        properties: {
          priority: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          action: { type: 'string' },
          rationale: { type: 'string' },
          hypothesis: { type: 'string' },
          test: { type: 'string' },
        },
      },
    },
    dataQuality: { type: 'array', items: { type: 'string' } },
  },
};

@Injectable()
export class ClaudeboxClientService {
  run(input: ClaudeboxRunInput): Promise<ClaudeboxRunOutput> {
    const url = process.env.CLAUDEBOX_WS_URL?.trim();
    const apiKey = process.env.CLAUDEBOX_API_KEY?.trim();
    if (!url || !apiKey) {
      throw new Error('CLAUDEBOX_WS_URL and CLAUDEBOX_API_KEY are required');
    }
    const timeoutMs = this.positiveInt(process.env.CREATIVE_AI_RUN_TIMEOUT_MS, 10 * 60 * 1000);

    return new Promise((resolveRun, rejectRun) => {
      const socket = new WebSocket(url, { maxPayload: 2 * 1024 * 1024 });
      let settled = false;
      let authenticated = false;
      let started = false;
      let responseText = '';
      let resultPayload: any = null;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        callback();
        socket.close();
      };
      const timeout = setTimeout(() => {
        if (started && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'prompt.cancel', requestId: input.runId }));
        }
        finish(() => rejectRun(new Error(`Claudebox analysis exceeded ${timeoutMs}ms`)));
      }, timeoutMs);

      socket.on('message', (raw: RawData) => {
        let message: any;
        try {
          message = JSON.parse(raw.toString());
        } catch {
          finish(() => rejectRun(new Error('Claudebox returned invalid JSON')));
          return;
        }
        if (message.type === 'connection.ready') {
          socket.send(JSON.stringify({ type: 'auth', apiKey }));
          return;
        }
        if (message.type === 'auth.ok') {
          authenticated = true;
          socket.send(JSON.stringify({
            type: 'prompt.start',
            requestId: input.runId,
            runToken: this.createRunToken(input),
            prompt: input.prompt,
            options: {
              cwd: input.workspace,
              provider: input.provider.toLowerCase(),
              model: input.model,
              effort: input.effort.toLowerCase(),
              maxTurns: input.maxTurns,
              maxBudgetUsd: input.maxBudgetUsd,
              allowedTools: ['Read', 'Glob'],
              jsonSchema: JSON.stringify(RESULT_SCHEMA),
            },
          }));
          return;
        }
        if (message.type === 'prompt.started' && message.requestId === input.runId) {
          started = true;
          return;
        }
        if (message.type === 'assistant.delta' && message.requestId === input.runId) {
          const delta = String(message.delta || '');
          responseText += delta;
          input.onDelta?.(delta);
          return;
        }
        if (message.type === 'prompt.result' && message.requestId === input.runId) {
          resultPayload = message;
          return;
        }
        if (message.type === 'prompt.completed' && message.requestId === input.runId) {
          if (!resultPayload || typeof resultPayload.result !== 'string') {
            finish(() => rejectRun(new Error('Claudebox completed without a result')));
            return;
          }
          finish(() => resolveRun({
            result: resultPayload.result,
            responseText: responseText || resultPayload.result,
            sessionId: resultPayload.sessionId || null,
            usage: resultPayload.usage || null,
            totalCostUsd: typeof resultPayload.totalCostUsd === 'number' ? resultPayload.totalCostUsd : null,
          }));
          return;
        }
        if ((message.type === 'prompt.failed' || message.type === 'error')
          && (!message.requestId || message.requestId === input.runId)) {
          finish(() => rejectRun(new Error(message.message || message.code || 'Claudebox request failed')));
        }
      });
      socket.on('error', (error) => finish(() => rejectRun(error)));
      socket.on('close', (code, reason) => {
        if (!settled) {
          const stage = authenticated ? (started ? 'during analysis' : 'before starting') : 'during authentication';
          finish(() => rejectRun(new Error(`Claudebox connection closed ${stage} (${code}: ${reason.toString()})`)));
        }
      });
    });
  }

  private createRunToken(input: ClaudeboxRunInput) {
    const secret = process.env.AI_AGENT_SIGNING_SECRET?.trim();
    if (!secret) return undefined;
    const header = this.base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const payload = this.base64Url(JSON.stringify({
      iss: 'erp-api',
      aud: 'claudebox',
      iat: now,
      exp: now + 10 * 60,
      tenantId: input.tenantId,
      userId: input.userId,
      runId: input.runId,
      workspace: input.workspace,
      provider: input.provider,
      model: input.model,
      effort: input.effort,
      scope: ['creative.video.analyze'],
    }));
    const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${signature}`;
  }

  private base64Url(value: string) {
    return Buffer.from(value, 'utf8').toString('base64url');
  }

  private positiveInt(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }

  private positiveNumber(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
