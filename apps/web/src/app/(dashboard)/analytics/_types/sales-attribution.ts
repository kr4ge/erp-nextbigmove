import type { SalesOverviewResponse } from './sales';
export { salesMetricDefinitions, salesSecondaryMetricDefinitions } from './sales';

export type SalesAttributionOverviewResponse = Omit<SalesOverviewResponse, 'filters' | 'selected'> & {
  filters: SalesOverviewResponse['filters'] & {
    teamCodes: string[];
    teamCodeDisplayMap: Record<string, string>;
  };
  selected: SalesOverviewResponse['selected'] & {
    teamCode: string | null;
  };
};

export type SalesAttributionOverviewParams = {
  startDate: string;
  endDate: string;
  teamCode: string | null;
  mappings: string[];
  excludeCancel: boolean;
  excludeRestocking: boolean;
  excludeAbandoned: boolean;
  excludeRts: boolean;
  includeTax12: boolean;
  includeTax1: boolean;
};
