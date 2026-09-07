import { ConflictException, Injectable } from '@nestjs/common';
import { CreativeOptionField } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CREATIVE_AGENT_PERMISSIONS } from '../creative-agent.constants';
import type { CreativeOptionFieldName } from '../dto/create-creative-option.dto';
import type { CreativeActor } from '../types/creative-actor.type';
import { CreativeAccessService } from './creative-access.service';

export type CreativeOption = { value: string; label: string; custom: boolean };

/**
 * The built-in vocabulary. Mirrors the web constants so both sides agree on
 * the starting list; tenant additions layer on top.
 */
const DEFAULTS: Record<CreativeOptionFieldName, CreativeOption[]> = {
  HOOK_TYPE: [
    { value: 'PAIN_POINT', label: 'Pain point', custom: false },
    { value: 'CURIOSITY', label: 'Curiosity', custom: false },
    { value: 'SOCIAL_PROOF', label: 'Social proof', custom: false },
    { value: 'BEFORE_AFTER', label: 'Before / after', custom: false },
  ],
  VIDEO_FORMAT: [
    { value: 'UGC', label: 'UGC', custom: false },
    { value: 'TESTIMONIAL', label: 'Testimonial', custom: false },
    { value: 'PRODUCT_DEMO', label: 'Product demo', custom: false },
    { value: 'PROBLEM_SOLUTION', label: 'Problem / solution', custom: false },
  ],
  STATIC_FORMAT: [
    { value: 'PRODUCT_IMAGE', label: 'Product image', custom: false },
    { value: 'LIFESTYLE', label: 'Lifestyle', custom: false },
    { value: 'GRAPHIC', label: 'Graphic', custom: false },
    { value: 'TESTIMONIAL_GRAPHIC', label: 'Testimonial graphic', custom: false },
    { value: 'CAROUSEL_FRAME', label: 'Carousel frame', custom: false },
  ],
};

/** Storage key: UPPER_SNAKE, so pills and filters humanize it like the defaults. */
export function toOptionValue(label: string): string {
  return label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function humanize(value: string): string {
  return value.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

@Injectable()
export class CreativeOptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreativeAccessService,
  ) {}

  /**
   * Defaults + the tenant's additions + any value already sitting on a
   * creative that neither list knows (legacy free text), so nothing that is
   * in use ever disappears from the dropdown.
   */
  async list(actor: CreativeActor) {
    const context = await this.access.resolve(actor);
    const [custom, inUse] = await Promise.all([
      this.prisma.creativeFieldOption.findMany({
        where: { tenantId: context.tenantId },
        select: { field: true, value: true, label: true },
        orderBy: { label: 'asc' },
      }),
      this.prisma.creative.findMany({
        where: { tenantId: context.tenantId },
        select: { kind: true, hookType: true, format: true },
        distinct: ['kind', 'hookType', 'format'],
      }),
    ]);

    const build = (field: CreativeOptionFieldName, legacy: string[]) => {
      const seen = new Map<string, CreativeOption>();
      for (const option of DEFAULTS[field]) seen.set(option.value, option);
      for (const row of custom) {
        if (row.field === field && !seen.has(row.value)) seen.set(row.value, { value: row.value, label: row.label, custom: true });
      }
      for (const value of legacy) {
        if (value && !seen.has(value)) seen.set(value, { value, label: humanize(value), custom: true });
      }
      return [...seen.values()];
    };

    return {
      hookTypes: build('HOOK_TYPE', inUse.map((r) => r.hookType ?? '')),
      videoFormats: build('VIDEO_FORMAT', inUse.filter((r) => r.kind === 'VIDEO').map((r) => r.format ?? '')),
      staticFormats: build('STATIC_FORMAT', inUse.filter((r) => r.kind === 'STATIC').map((r) => r.format ?? '')),
    };
  }

  async create(actor: CreativeActor, field: CreativeOptionFieldName, label: string): Promise<CreativeOption> {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.ENROLL);

    const value = toOptionValue(label);
    if (!value) throw new ConflictException('Enter at least one letter or number');
    const existingDefault = DEFAULTS[field].find((option) => option.value === value);
    if (existingDefault) return existingDefault;

    const row = await this.prisma.creativeFieldOption.upsert({
      where: { tenantId_field_value: { tenantId: context.tenantId, field: field as CreativeOptionField, value } },
      update: {},
      create: {
        tenantId: context.tenantId,
        field: field as CreativeOptionField,
        value,
        label: label.trim(),
        createdById: context.userId,
      },
      select: { value: true, label: true },
    });
    return { value: row.value, label: row.label, custom: true };
  }
}
