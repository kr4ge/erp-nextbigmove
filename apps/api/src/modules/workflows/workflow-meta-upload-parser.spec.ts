import { describe, expect, it } from '@jest/globals';
import { WorkflowService } from './workflow.service';

describe('WorkflowService manual Meta upload parsing', () => {
  const service = Object.create(WorkflowService.prototype) as WorkflowService;
  const parser = service as unknown as {
    resolveColumnIndexes(header: unknown[]): {
      indexes: Record<string, number>;
      spendCurrency: string | null;
    };
    parseUploadRow(
      row: unknown[],
      rowNumber: number,
      columns: unknown,
      accountNameMap: Map<string, unknown>,
    ): Record<string, unknown> | null;
    resolveManualUploadMultiplier(
      account: Record<string, unknown> | null,
      sourceCurrency?: string,
      fallbackCurrencyMultiplier?: number,
    ): number;
    shouldCleanupManualMetaUploadFile(
      job: { opts: { attempts?: number }; attemptsMade: number },
      processingCompleted: boolean,
    ): boolean;
  };

  it('accepts the legacy PHP template without changing its values', () => {
    const header = [
      'Account ID',
      'Campaign ID',
      'Campaign name',
      'Ad set ID',
      'Ad ID',
      'Ad name',
      'Amount spent (PHP)',
      'Link clicks',
      'Clicks (all)',
      'Impressions',
      'Website purchases',
      'Reporting starts',
      'Reporting ends',
    ];
    const columns = parser.resolveColumnIndexes(header);
    const row = [
      'act_123',
      'campaign-1',
      'Campaign',
      'adset-1',
      'ad-1',
      'AP-V0001',
      '125.50',
      '7',
      '9',
      '100',
      '2',
      '2026-08-20',
      '2026-08-20',
    ];

    expect(parser.parseUploadRow(row, 2, columns, new Map())).toMatchObject({
      accountId: '123',
      amountSpent: 125.5,
      linkClicks: 7,
      clicks: 9,
      impressions: 100,
      websitePurchases: 2,
      spendCurrency: 'PHP',
      videoPlays3s: null,
      thruPlays: null,
    });
  });

  it('accepts the new video template and resolves Account name to Account ID', () => {
    const header = [
      'Ad name',
      'Reporting starts',
      'Reporting ends',
      'Account name',
      'Campaign name',
      'Campaign ID',
      'Ad set name',
      'Ad set ID',
      'Ad ID',
      'Impressions',
      'CPM (cost per 1,000 impressions) (USD)',
      '3-second video plays',
      'Link clicks',
      'Frequency',
      'ThruPlays',
      'custom_derived_metrics:122191075154774613',
      'Amount spent (USD)',
      'custom_derived_metrics:122192019458774613',
      'Video average play time',
      'Video plays at 25%',
      'Video plays at 50%',
      'Video plays at 75%',
      'Video plays at 95%',
      'Video plays at 100%',
    ];
    const columns = parser.resolveColumnIndexes(header);
    const row = [
      'INTERVIEW l [NRO-V0071] l JOSIAH',
      '2026-08-20',
      '2026-08-20',
      '1536 - 70006 - 011475 - ogimiwellness - YP - SMX',
      '081026 l OGIMI l VIDEO l JR - TEST',
      '52542758800273',
      'BROAD l ADSET',
      '52542758799673',
      '52542759068873',
      '268',
      '20.447761',
      '85',
      '17',
      '1.207207',
      '30',
      '0.31716418',
      '5.48',
      '339.76',
      '8',
      '27',
      '16',
      '10',
      '10',
      '10',
    ];
    const accountNameMap = new Map([
      [
        '1536 - 70006 - 011475 - ogimiwellness - yp - smx',
        {
          accountId: '456',
          name: '1536 - 70006 - 011475 - ogimiwellness - YP - SMX',
          teamId: null,
          integrationId: 'integration-1',
          currency: 'USD',
          currencyMultiplier: 58,
        },
      ],
    ]);

    expect(parser.parseUploadRow(row, 2, columns, accountNameMap)).toMatchObject({
      accountId: '456',
      amountSpent: 5.48,
      linkClicks: 17,
      clicks: 17,
      impressions: 268,
      websitePurchases: 0,
      spendCurrency: 'USD',
      videoPlays3s: 85,
      thruPlays: 30,
      frequency: 1.207207,
      videoAveragePlayTime: 8,
      videoPlays25: 27,
      videoPlays50: 16,
      videoPlays75: 10,
      videoPlays95: 10,
      videoPlays100: 10,
    });
  });

  it('requires either Account ID or Account name', () => {
    expect(() => parser.resolveColumnIndexes([
      'Campaign ID',
      'Campaign name',
      'Ad set ID',
      'Ad ID',
      'Ad name',
      'Amount spent',
      'Link clicks',
      'Impressions',
      'Reporting starts',
      'Reporting ends',
    ])).toThrow('accountId or accountName');
  });

  it('uses a stable manual identity when Account name has no integration', () => {
    const columns = parser.resolveColumnIndexes([
      'Account name',
      'Campaign ID',
      'Campaign name',
      'Ad set ID',
      'Ad ID',
      'Ad name',
      'Amount spent (USD)',
      'Link clicks',
      'Impressions',
      'Reporting starts',
      'Reporting ends',
    ]);

    expect(parser.parseUploadRow([
      'Ogimi Wellness',
      'campaign-1',
      'Campaign',
      'adset-1',
      'ad-1',
      'NRO-V0001',
      '5.48',
      '17',
      '268',
      '2026-08-20',
      '2026-08-20',
    ], 2, columns, new Map())).toMatchObject({
      accountId: 'manual:ogimi wellness',
      spendCurrency: 'USD',
    });
  });

  it('preserves legacy PHP spend and converts the new USD export', () => {
    const account = {
      accountId: '456',
      name: 'Ogimi Wellness',
      teamId: null,
      integrationId: 'integration-1',
      currency: 'USD',
      currencyMultiplier: 58,
    };

    expect(parser.resolveManualUploadMultiplier(account, 'PHP')).toBe(1);
    expect(parser.resolveManualUploadMultiplier(account, 'USD')).toBe(58);
    expect(() => parser.resolveManualUploadMultiplier(
      { ...account, currencyMultiplier: null },
      'USD',
    )).toThrow('positive USD currency multiplier');
    expect(parser.resolveManualUploadMultiplier(null, 'USD', 58)).toBe(58);
    expect(() => parser.resolveManualUploadMultiplier(null, 'USD')).toThrow(
      'Enter a positive USD currency multiplier for this manual upload',
    );
  });

  it('keeps the uploaded file for retries and removes it after completion or the final attempt', () => {
    expect(parser.shouldCleanupManualMetaUploadFile(
      { opts: { attempts: 2 }, attemptsMade: 0 },
      false,
    )).toBe(false);
    expect(parser.shouldCleanupManualMetaUploadFile(
      { opts: { attempts: 2 }, attemptsMade: 1 },
      false,
    )).toBe(true);
    expect(parser.shouldCleanupManualMetaUploadFile(
      { opts: { attempts: 2 }, attemptsMade: 0 },
      true,
    )).toBe(true);
  });
});
