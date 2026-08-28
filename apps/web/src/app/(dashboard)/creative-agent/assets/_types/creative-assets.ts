import type { CreativeKind, CreativePerformanceStatus, CreativeRevisionState } from '../../video-registry/_types/video-registry';

export type CreativeAsset = {
  id: string;
  code: string;
  title: string;
  /** Pancake custom ID of the advertised item; null on pre-item creatives. */
  customId: string | null;
  kind: CreativeKind;
  mediaUrl: string | null;
  format: string | null;
  hookType: string | null;
  script: string | null;
  notes: string | null;
  revisionState: CreativeRevisionState;
  revisionRequestedAt: string | null;
  revisionResolvedAt: string | null;
  performanceStatus: CreativePerformanceStatus;
  creator: { id: string; name: string; adName?: string; avatar: string | null };
  store: { id: string | null; name: string };
  isOwnSubmission: boolean;
  commentCount: number;
  lastCommentAt: string | null;
  linked: boolean;
  metaAdIds: string[];
  /** Signed URL for the cached Facebook post cover, when one was captured. */
  thumbnailUrl: string | null;
  thumbnailIsVideo: boolean;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreativeAssetComment = {
  id: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; avatar: string | null };
};

export type CreativeAssetsParams = {
  query: string;
  storeId: string;
  creatorId: string;
  creativeId: string;
  revisionState: '' | CreativeRevisionState;
  queue: '' | 'REVIEW';
  page: number;
  pageSize: number;
};

export type CreativeAssetsResponse = {
  permissions: { canReadAll: boolean };
  selected: CreativeAssetsParams;
  filters: {
    stores: Array<{ value: string; label: string }>;
    defaultStoreId?: string | null;
    creators: Array<{ value: string; label: string }>;
    revisionStates: Array<{ value: CreativeRevisionState; label: string }>;
  };
  summary: Record<string, number>;
  items: CreativeAsset[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  generatedAt: string;
};

export type CreativeAssetsView = 'tiles' | 'table';
