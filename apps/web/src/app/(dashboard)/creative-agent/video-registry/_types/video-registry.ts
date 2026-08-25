/** Advertising's request-for-changes signal — not an approval gate. */
export type CreativeRevisionState = "NONE" | "NEEDS_REVISION" | "RESOLVED";
export type CreativePerformanceStatus =
  | "DRAFT"
  | "LIVE"
  | "WINNER"
  | "FATIGUED"
  | "RETIRED";
export type CreativeStatusDimension = "REVISION" | "PERFORMANCE";
export type VideoRegistryView = "table" | "tiles";
export type CreativeKind = "VIDEO" | "STATIC";
export type VideoRegistrySortKey =
  | "code"
  | "title"
  | "spend"
  | "hookRate"
  | "holdRate"
  | "ctr";
export type SortDirection = "asc" | "desc";
export type RegistryPerson = {
  id: string;
  name: string;
  avatar?: string | null;
};
export type RegistryOption = {
  value: string;
  label: string;
  active?: boolean;
  nextCode?: string;
};
export type RegistryStore = {
  id: string | null;
  configId: string;
  name: string;
  shopId: string;
  codePrefix: string;
  active: boolean;
};
export type VideoRegistryMetrics = {
  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  videoPlays3s: number | null;
  thruPlays: number | null;
  hookRate: number | null;
  holdRate: number | null;
  completionRate: number | null;
  ctr: number | null;
  cpm: number | null;
  costPerThruPlay: number | null;
  retention25: number | null;
  retention50: number | null;
  retention75: number | null;
  retention95: number | null;
  retention100: number | null;
};
export type VideoRegistryItem = {
  id: string;
  code: string;
  title: string;
  store: RegistryStore;
  kind: CreativeKind;
  accountIds: string[];
  metaAccountId: string | null;
  metaAdId: string | null;
  metaAdNameSnapshot: string | null;
  metaLinkSource: "AUTO_CODE" | "MANUAL" | null;
  metaLinkedAt: string | null;
  creator: RegistryPerson;
  format: string | null;
  hookType: string | null;
  script: string | null;
  notes: string | null;
  mediaUrl: string | null;
  /** Signed URL for the cached post cover, when captured. */
  thumbnailUrl?: string | null;
  thumbnailIsVideo?: boolean;
  aliases: string[];
  aliasRecords?: Array<{ id: string; alias: string; createdAt: string }>;
  revisionState: CreativeRevisionState;
  performanceStatus: CreativePerformanceStatus;
  metrics: VideoRegistryMetrics;
  submittedAt?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};
export type CreativeReviewComment = {
  id: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  author: RegistryPerson;
};
export type UnregisteredMetaCreative = {
  key: string;
  code: string | null;
  adName: string;
  accountId: string;
  adId: string;
  accountName: string;
  store: Pick<RegistryStore, "id" | "configId" | "name" | "codePrefix"> | null;
  spend: number;
  impressions: number;
  clicks: number;
  firstSeenAt: string;
  lastSeenAt: string;
};
export type VideoRegistryFilterOptions = {
  stores: RegistryOption[];
  creators: RegistryOption[];
  accounts: RegistryOption[];
  revisionStates: RegistryOption[];
  performanceStatuses: RegistryOption[];
};
export type GetVideoRegistryParams = {
  startDate: string;
  endDate: string;
  query: string;
  kind: "" | CreativeKind;
  accountId: string;
  storeId: string;
  creatorId: string;
  revisionState: "" | CreativeRevisionState;
  performanceStatus: "" | CreativePerformanceStatus;
  page: number;
  pageSize: number;
  unregisteredPage: number;
  unregisteredPageSize: number;
  sortKey: VideoRegistrySortKey;
  sortDirection: SortDirection;
};
export type VideoRegistryResponse = {
  selected: GetVideoRegistryParams;
  filters: VideoRegistryFilterOptions;
  items: VideoRegistryItem[];
  unregistered: UnregisteredMetaCreative[];
  summary: { untaggedSpend: number };
  metricsAvailability: Record<string, boolean | string>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  unregisteredPagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  generatedAt: string;
};
export type CreateVideoRegistryInput = {
  submitForApproval?: boolean;
  kind: CreativeKind;
  storeId: string;
  title: string;
  mediaUrl: string;
  format: string;
  hookType: string;
  script?: string;
  notes?: string;
  requestedCode?: string;
  unregisteredKey?: string;
  adName?: string;
  accountId?: string;
  adId?: string;
};
export type UpdateVideoRegistryInput = Pick<
  CreateVideoRegistryInput,
  "title" | "mediaUrl" | "format" | "hookType" | "script" | "notes"
>;
export type LinkCreativeAliasInput = {
  unregisteredKey: string;
  creativeId: string;
  alias: string;
  accountId: string;
  adId: string;
};
export type CreativeStoreOption = {
  id: string;
  shopId: string;
  name: string;
  avatarUrl: string | null;
  enabled: boolean;
  nextCode: string;
  registry: {
    id: string;
    codePrefix: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
};
export type CreativePermissions = {
  canReadAll: boolean;
  canEnroll: boolean;
  canEdit: boolean;
  canEditAll: boolean;
  canManageAliases: boolean;
  canReview: boolean;
  canManagePerformance: boolean;
};
