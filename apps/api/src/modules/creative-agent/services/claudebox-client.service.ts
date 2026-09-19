import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import WebSocket = require('ws');
import type { RawData } from 'ws';
import { readFile, readdir } from 'fs/promises';
import { join, relative, sep } from 'path';
import { creativeAiRunTimeoutMs } from '../utils/creative-ai-timeouts';

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
  maxRunMinutes: number;
  /**
   * Local directory holding the prepared run files. When set, they are pushed
   * to the gateway before the run starts, which is what lets the gateway live
   * on a different host with no shared volume.
   */
  localWorkspace?: string;
  /**
   * Structured-output schema for this run. Defaults to the creative analysis
   * schema; the enrollment gate supplies its own, much smaller one.
   */
  jsonSchema?: unknown;
  /** Aborting the signal cancels the run on the gateway and rejects with CreativeAiRunCancelledError. */
  signal?: AbortSignal;
  onDelta?: (text: string) => void;
  /** Live activity: which tool the agent is using, and what it is thinking. */
  onActivity?: (entry: CreativeAiActivityEntry) => void;
};

export type CreativeAiActivityEntry =
  | { kind: 'TOOL'; tool: string; target: string | null }
  | { kind: 'THINKING' }
  | { kind: 'TEXT'; text: string };

export type ClaudeboxRunOutput = {
  result: string;
  responseText: string;
  sessionId: string | null;
  usage: unknown;
  totalCostUsd: number | null;
};

export class CreativeAiRunCancelledError extends Error {
  constructor(message = 'The analysis was cancelled') {
    super(message);
    this.name = 'CreativeAiRunCancelledError';
  }
}

/**
 * The run ended because a configured limit was reached (cost cap, turn cap).
 * Retrying with the same settings would end the same way, so the worker
 * treats this as final on any attempt.
 */
export class CreativeAiRunLimitError extends Error {
  constructor(message: string, readonly subtype: string) {
    super(message);
    this.name = 'CreativeAiRunLimitError';
  }
}

const LIMIT_SUBTYPES = new Set(['error_max_budget_usd', 'error_max_turns']);

/** What an analysis is allowed to read: sampled frames, contact sheets and the JSON context. */
const TRANSFERABLE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.json'];
/**
 * Working directories the model never needs: grid frames only exist to build
 * the sheets, thumbnails go to object storage for the storyboard, and the
 * transcript is already inside video-timeline.json.
 */
const UNTRANSFERABLE_DIRECTORIES = new Set(['grid', 'thumbs', 'transcript']);
/** The gateway's WebSocket message cap; one run.files message must fit under it. */
const DEFAULT_GATEWAY_MESSAGE_BYTES = 12_582_912;

/**
 * Read a prepared run directory into the shape the gateway accepts. Only the
 * file types an analysis needs are sent; the source video is already deleted
 * by this point and would not be sent in any case.
 */
async function collectRunFiles(root: string) {
  const files: Array<{ path: string; base64: string }> = [];

  const walk = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (directory === root && UNTRANSFERABLE_DIRECTORIES.has(entry.name)) continue;
        await walk(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      const relativePath = relative(root, absolute).split(sep).join('/');
      if (!TRANSFERABLE_EXTENSIONS.some((extension) => relativePath.toLowerCase().endsWith(extension))) continue;
      files.push({ path: relativePath, base64: (await readFile(absolute)).toString('base64') });
    }
  };

  await walk(root);
  const sorted = files.sort((a, b) => a.path.localeCompare(b.path));
  // The gateway closes the socket on an oversized message, which surfaces as a
  // bare disconnect. Refuse up front with a message that says what to change.
  const cap = Number(process.env.CLAUDEBOX_MAX_BODY_BYTES) > 0 ? Number(process.env.CLAUDEBOX_MAX_BODY_BYTES) : DEFAULT_GATEWAY_MESSAGE_BYTES;
  const payloadBytes = sorted.reduce((sum, file) => sum + file.base64.length + file.path.length + 40, 2_048);
  if (payloadBytes > cap) {
    const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);
    throw new Error(
      `The prepared analysis files (${mb(payloadBytes)} MB encoded) exceed the gateway's ${mb(cap)} MB message limit. `
      + 'Lower CREATIVE_AI_PUSH_BUDGET_BYTES, or raise CLAUDEBOX_MAX_BODY_BYTES on both the gateway and the ERP.',
    );
  }
  return sorted;
}

function errorForSubtype(subtype: string, input: ClaudeboxRunInput, detail?: string) {
  const message = describeResultSubtype(subtype, input, detail);
  return LIMIT_SUBTYPES.has(subtype) ? new CreativeAiRunLimitError(message, subtype) : new Error(message);
}

const FINDING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['timestampSeconds', 'observation', 'metricConnection', 'evidenceType'],
  properties: {
    timestampSeconds: { type: ['number', 'null'] },
    observation: { type: 'string' },
    metricConnection: { type: 'string' },
    evidenceType: { type: 'string', enum: ['OBSERVED', 'MEASURED', 'HYPOTHESIS'] },
  },
};

const RECOMMENDATION_SCHEMA = {
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
};

/**
 * Findings and recommendations are capped per section. The model ranks them
 * anyway, so a cap keeps the highest-value items and removes the long tail
 * that made runs take minutes longer to write without adding much.
 */
const SECTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['score', 'verdict', 'findings', 'recommendations'],
  properties: {
    score: { type: 'integer', minimum: 1, maximum: 5 },
    verdict: { type: 'string' },
    findings: { type: 'array', maxItems: 4, items: FINDING_SCHEMA },
    recommendations: { type: 'array', maxItems: 3, items: RECOMMENDATION_SCHEMA },
  },
};

/**
 * Sectioned result, one entry per analysis category, so the dialog can show
 * a tab per category with its own score. Version 2 of the contract; runs
 * stored before it keep the flat shape and the UI reads both.
 */
const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['version', 'overview', 'sections'],
  properties: {
    version: { type: 'integer', enum: [2] },
    overview: {
      type: 'object',
      additionalProperties: false,
      required: ['verdict', 'summary', 'confidence', 'topActions', 'complianceFlags', 'dataQuality'],
      properties: {
        verdict: { type: 'string' },
        summary: { type: 'string' },
        confidence: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
        topActions: {
          type: 'array',
          maxItems: 3,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['category', 'priority', 'action', 'rationale', 'hypothesis', 'test'],
            properties: {
              category: { type: 'string', enum: ['hook', 'storyPacing', 'messageOffer', 'productProof', 'callToAction', 'performance'] },
              ...RECOMMENDATION_SCHEMA.properties,
            },
          },
        },
        complianceFlags: { type: 'array', maxItems: 12, items: { type: 'string' } },
        dataQuality: { type: 'array', maxItems: 8, items: { type: 'string' } },
      },
    },
    sections: {
      type: 'object',
      additionalProperties: false,
      required: ['hook', 'storyPacing', 'messageOffer', 'productProof', 'callToAction', 'performance'],
      properties: {
        hook: SECTION_SCHEMA,
        storyPacing: SECTION_SCHEMA,
        messageOffer: SECTION_SCHEMA,
        productProof: SECTION_SCHEMA,
        callToAction: SECTION_SCHEMA,
        performance: SECTION_SCHEMA,
      },
    },
  },
};

/**
 * The readable part of a tool call's arguments: a file name for file tools, a
 * pattern for search tools. Arguments stream in as JSON fragments, so this
 * tolerates a partial or unparsable value.
 */
function describeToolTarget(partialJson: string): string | null {
  try {
    const parsed = JSON.parse(partialJson);
    const raw = parsed.file_path || parsed.path || parsed.pattern || parsed.query;
    if (typeof raw !== 'string' || !raw) return null;
    return shortenPath(raw);
  } catch {
    const match = partialJson.match(/"(?:file_path|path|pattern|query)"\s*:\s*"([^"]+)/);
    if (!match) return null;
    return shortenPath(match[1]);
  }
}

/** Tenant and run folders are UUIDs and mean nothing to a reader; drop them. */
function shortenPath(raw: string) {
  const segments = raw.split('/').filter(Boolean)
    .filter((segment) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment));
  return segments.slice(-2).join('/') || null;
}

/**
 * Translate a Claude Code result subtype into a message a user can act on.
 * The gateway forwards the subtype both on a clean completion and on a
 * failure, so a budget or turn limit no longer surfaces as a generic error.
 */
function describeResultSubtype(subtype: string, input: ClaudeboxRunInput, detail?: string) {
  switch (subtype) {
    case 'error_max_turns':
      return `The analysis stopped after reaching the maximum of ${input.maxTurns} agent turns before it finished. Raise "Maximum agent turns" in Settings → AI.`;
    case 'error_max_budget_usd':
      // No cost cap is sent any more; a provider-side budget error means the
      // subscription itself is exhausted for this window.
      return 'The AI provider stopped the run because the account reached its usage limit. Wait for the limit to reset, or connect a different account in Settings → AI.';
    case 'error_during_execution':
      return `The AI provider reported an error while analyzing${detail ? `: ${detail}` : '.'}`;
    default:
      return `The AI provider ended the run with status "${subtype}"${detail ? `: ${detail}` : '.'}`;
  }
}

@Injectable()
export class ClaudeboxClientService {
  run(input: ClaudeboxRunInput): Promise<ClaudeboxRunOutput> {
    const url = process.env.CLAUDEBOX_WS_URL?.trim();
    const apiKey = process.env.CLAUDEBOX_API_KEY?.trim();
    if (!url || !apiKey) {
      throw new Error('CLAUDEBOX_WS_URL and CLAUDEBOX_API_KEY are required');
    }
    if (input.signal?.aborted) {
      return Promise.reject(new CreativeAiRunCancelledError());
    }
    const timeoutMs = creativeAiRunTimeoutMs(input.maxRunMinutes);

    return new Promise((resolveRun, rejectRun) => {
      const socket = new WebSocket(url, { maxPayload: 2 * 1024 * 1024 });
      let settled = false;
      let authenticated = false;
      let started = false;
      let responseText = '';
      let resultPayload: any = null;
      let cancelTimer: NodeJS.Timeout | undefined;
      // Claude Code streams a tool call as: content_block_start (tool name),
      // then input_json_delta fragments carrying the arguments, then
      // content_block_stop. Assemble them so the UI can say "Read frames/hook-01.jpg".
      const toolBlocks = new Map<number, { name: string; json: string }>();

      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (cancelTimer) clearTimeout(cancelTimer);
        input.signal?.removeEventListener('abort', onAbort);
        callback();
        socket.close();
      };
      const requestCancel = () => {
        if (started && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'prompt.cancel', requestId: input.runId }));
        }
      };
      const onAbort = () => {
        if (settled) return;
        requestCancel();
        if (started && socket.readyState === WebSocket.OPEN) {
          // Give the gateway a moment to stop the process and acknowledge.
          cancelTimer = setTimeout(() => finish(() => rejectRun(new CreativeAiRunCancelledError())), 5_000);
        } else {
          finish(() => rejectRun(new CreativeAiRunCancelledError()));
        }
      };
      const timeout = setTimeout(() => {
        requestCancel();
        finish(() => rejectRun(new Error(`Claudebox analysis exceeded ${timeoutMs}ms`)));
      }, timeoutMs);
      input.signal?.addEventListener('abort', onAbort, { once: true });

      const sendPromptStart = () => {
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
            maxRunMinutes: input.maxRunMinutes,
            allowedTools: ['Read', 'Glob'],
            jsonSchema: JSON.stringify(input.jsonSchema ?? RESULT_SCHEMA),
          },
        }));
      };

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
          // With the gateway on another host there is no shared volume, so the
          // prepared files travel over this socket first. The run starts only
          // once the gateway confirms it has written them.
          if (input.localWorkspace) {
            collectRunFiles(input.localWorkspace)
              .then((files) => {
                if (settled) return;
                if (!files.length) {
                  finish(() => rejectRun(new Error('The prepared analysis files are missing from the workspace')));
                  return;
                }
                socket.send(JSON.stringify({
                  type: 'run.files',
                  requestId: input.runId,
                  runToken: this.createRunToken(input),
                  tenantId: input.tenantId,
                  cwd: input.workspace,
                  provider: input.provider.toLowerCase(),
                  model: input.model,
                  effort: input.effort.toLowerCase(),
                  files,
                }));
              })
              .catch((error) => finish(() => rejectRun(error instanceof Error ? error : new Error(String(error)))));
            return;
          }
          sendPromptStart();
          return;
        }
        if (message.type === 'run.files.ok' && message.requestId === input.runId) {
          sendPromptStart();
          return;
        }
        if (message.type === 'prompt.started' && message.requestId === input.runId) {
          started = true;
          if (input.signal?.aborted) onAbort();
          return;
        }
        if (message.type === 'assistant.delta' && message.requestId === input.runId) {
          const delta = String(message.delta || '');
          responseText += delta;
          input.onDelta?.(delta);
          return;
        }
        if (message.type === 'agent.event' && message.requestId === input.runId && input.onActivity) {
          const event = message.event?.event;
          const index = event?.index;
          if (event?.type === 'content_block_start' && typeof index === 'number') {
            const block = event.content_block;
            if (block?.type === 'tool_use') toolBlocks.set(index, { name: String(block.name || 'Tool'), json: '' });
            if (block?.type === 'thinking') input.onActivity({ kind: 'THINKING' });
          }
          if (event?.type === 'content_block_delta' && typeof index === 'number' && event.delta?.type === 'input_json_delta') {
            const block = toolBlocks.get(index);
            if (block) block.json += String(event.delta.partial_json || '');
          }
          if (event?.type === 'content_block_stop' && typeof index === 'number') {
            const block = toolBlocks.get(index);
            if (block) {
              toolBlocks.delete(index);
              input.onActivity({ kind: 'TOOL', tool: block.name, target: describeToolTarget(block.json) });
            }
          }
          return;
        }
        if (message.type === 'prompt.result' && message.requestId === input.runId) {
          resultPayload = message;
          return;
        }
        if (message.type === 'prompt.cancelled' && message.requestId === input.runId) {
          finish(() => rejectRun(new CreativeAiRunCancelledError()));
          return;
        }
        if (message.type === 'prompt.completed' && message.requestId === input.runId) {
          const subtype = typeof resultPayload?.subtype === 'string' ? resultPayload.subtype : null;
          if (subtype && subtype !== 'success') {
            finish(() => rejectRun(errorForSubtype(subtype, input)));
            return;
          }
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
          const subtype = typeof message.resultSubtype === 'string' && message.resultSubtype !== 'success'
            ? message.resultSubtype
            : null;
          const detail = message.message || message.code || 'Claudebox request failed';
          finish(() => rejectRun(subtype ? errorForSubtype(subtype, input, detail) : new Error(detail)));
        }
      });
      socket.on('error', (error) => finish(() => rejectRun(error)));
      socket.on('close', (code, reason) => {
        if (!settled) {
          if (input.signal?.aborted) {
            finish(() => rejectRun(new CreativeAiRunCancelledError()));
            return;
          }
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
}
