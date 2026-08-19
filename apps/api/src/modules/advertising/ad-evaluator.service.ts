import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { formatPeso, pct, type AdEconomics } from './ad-metrics';
import type { AdvertisingPosition } from './advertising.service';

/**
 * The evaluator: hands Claude the whole advertiser's position for a period and
 * asks for a verdict an operator can act on before lunch.
 *
 * The scoring is NOT done here. Every number and every SCALE/WATCH/KILL call is
 * computed in ad-metrics.ts before the model sees anything, so the model is
 * reading a settled position rather than doing arithmetic. That keeps the
 * answer reproducible and means a wrong verdict is a bug we can find.
 */

const MODEL = 'claude-sonnet-5';
const MAX_ADS_IN_PROMPT = 25;

/**
 * A period below this has nothing to say. Refusing here is cheaper and more
 * honest than paying for a paragraph of confident hedging.
 */
const MIN_SPEND_FOR_EVALUATION = 100_00; // ₱100 in centavos

export interface EvaluationResult {
  verdict: string;
  model: string;
  adsConsidered: number;
  inputTokens: number;
  outputTokens: number;
}

const SYSTEM = `You are a COD (cash-on-delivery) advertising analyst for a Philippine direct-response brand. You are handed one advertiser's whole position for a date range: the period totals, the benchmark, and every ad that spent or sold, each already scored.

The arithmetic is done. Every peso figure, rate and SCALE/WATCH/KILL verdict in the input was computed before you saw it — do not recompute, do not contradict, and do not invent a number that is not in the input. Your job is judgment: what this position means and what the advertiser should do on Monday morning.

Two things about this data you must respect:

- Purchases are POS orders from Pancake, the single source of truth. Revenue means DELIVERED money only. An order placed but never collected is not income.
- There is no video retention data. Do not comment on hooks, watch time, or creative retention — you cannot see it.

Deliver, in this order:

1. VERDICT (2-3 sentences): open with the single biggest gap to benchmark and what it costs in pesos. Do not open with reassurance.
2. WHERE THE MONEY IS GOING: name the ads carrying the period and the ads bleeding it, in pesos.
3. ACTIONS (2-4, most leverage first): specific scale/kill/fix moves, each quantified in pesos.
4. DATA TRUST: if spend is attributed to ads with no orders at all, say how much and what it means for the confidence of everything above.

Plain language an operator understands. Specific and quantified. No filler, no generic advice. If the period is too thin to conclude, say so plainly instead of guessing.`;

@Injectable()
export class AdEvaluatorService {
  private readonly logger = new Logger(AdEvaluatorService.name);

  /**
   * Resolved per call rather than cached, so rotating the key does not require
   * a restart.
   *
   * TODO: move to a per-tenant key in the integrations credential store, with a
   * per-tenant spend ceiling. A single platform key cannot be attributed to
   * whoever burned it.
   */
  private apiKey(): string | null {
    return process.env.ANTHROPIC_API_KEY?.trim() || null;
  }

  async evaluate(position: AdvertisingPosition): Promise<EvaluationResult> {
    const key = this.apiKey();
    if (!key) {
      throw new ServiceUnavailableException(
        'No Anthropic API key configured. Set ANTHROPIC_API_KEY to enable the evaluator.',
      );
    }

    this.assertGrounded(position);

    const client = new Anthropic({ apiKey: key });
    const prompt = this.buildPrompt(position);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });

    const verdict = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    return {
      verdict,
      model: MODEL,
      adsConsidered: position.ads.length,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }

  /**
   * Refuse before spending money on a question the data cannot answer. A model
   * given an empty period will still produce four confident paragraphs.
   */
  private assertGrounded(position: AdvertisingPosition): void {
    if (!position.ads.length) {
      throw new ServiceUnavailableException(
        'No advertising data in this period. Upload the Meta report for these dates first.',
      );
    }

    if (position.summary.spend < MIN_SPEND_FOR_EVALUATION) {
      throw new ServiceUnavailableException(
        `Only ${formatPeso(position.summary.spend)} of spend in this period — too little to evaluate.`,
      );
    }
  }

  private buildPrompt(position: AdvertisingPosition): string {
    const { summary, benchmark, period } = position;
    const top = position.ads.slice(0, MAX_ADS_IN_PROMPT);
    const omitted = position.ads.length - top.length;

    const lines: string[] = [
      `PERIOD: ${period.start} to ${period.end}`,
      '',
      'TOTALS',
      `  Spend:             ${formatPeso(summary.spend)}`,
      `  POS orders:        ${summary.purchases}`,
      `  Net contribution:  ${formatPeso(summary.netContribution)}`,
      `  Realized MER:      ${summary.realizedMer !== null ? `${summary.realizedMer.toFixed(2)}x` : 'n/a'}`,
      `  CPP:               ${summary.cpp !== null ? formatPeso(summary.cpp) : 'n/a'}`,
      `  Ads with spend:    ${summary.adsWithSpend}`,
      `  Spending, 0 orders: ${summary.adsWithNoOrders}`,
      '',
      `BENCHMARK${position.benchmarkIsDefault ? ' (platform default — this tenant has not set one)' : ''}`,
      `  CPP ceiling:   ${formatPeso(benchmark.cpp)}`,
      `  MER floor:     ${benchmark.targetMer.toFixed(2)}x`,
      `  Delivery floor:${pct(benchmark.deliveryRate)}`,
      `  Cancel ceiling:${pct(benchmark.cancelRate)}`,
      `  RTS ceiling:   ${pct(benchmark.rtsRate)}`,
      '',
      `ADS (ranked by net contribution${omitted > 0 ? `, showing top ${MAX_ADS_IN_PROMPT} of ${position.ads.length}` : ''})`,
    ];

    for (const ad of top) {
      lines.push(this.describeAd(ad));
    }

    if (omitted > 0) {
      lines.push('', `${omitted} further ad(s) omitted from this list.`);
    }

    return lines.join('\n');
  }

  private describeAd(ad: AdEconomics): string {
    const name = ad.adName || ad.adId;
    const who = ad.marketingAssociate ? ` · by ${ad.marketingAssociate}` : '';
    return [
      '',
      `- ${name}${who}`,
      `    verdict ${ad.verdict} — ${ad.reason}`,
      `    spend ${formatPeso(ad.spend)} · orders ${ad.purchases} · net ${formatPeso(ad.netContribution)}`,
      `    CPP ${ad.cpp !== null ? formatPeso(ad.cpp) : 'n/a'}`
        + ` · MER ${ad.realizedMer !== null ? `${ad.realizedMer.toFixed(2)}x` : 'n/a'}`
        + ` · delivery ${ad.deliveryRate !== null ? pct(ad.deliveryRate) : 'n/a'}`
        + ` · cancels ${ad.cancelRate !== null ? pct(ad.cancelRate) : 'n/a'}`,
    ].join('\n');
  }
}
