import type { CreativeKind, CreativePerformanceStatus, CreativeQcStatus } from '../../video-registry/_types/video-registry';

export type CreativeAsset = {
  id: string;
  code: string;
  title: string;
  kind: CreativeKind;
  mediaUrl: string | null;
  format: string | null;
  hookType: string | null;
  script: string | null;
  notes: string | null;
  qcStatus: CreativeQcStatus;
  performanceStatus: CreativePerformanceStatus;
  creator: { id: string; name: string; avatar: string | null };
  store: { id: string | null; name: string };
  isOwnSubmission: boolean;
  commentCount: number;
  lastCommentAt: string | null;
  linked: boolean;
  metaAdIds: string[];
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
  qcStatus: '' | CreativeQcStatus;
  queue: '' | 'REVIEW';
  page: number;
  pageSize: number;
};

export type CreativeAssetsResponse = {
  permissions: { canReadAll: boolean };
  selected: CreativeAssetsParams;
  filters: {
    stores: Array<{ value: string; label: string }>;
    creators: Array<{ value: string; label: string }>;
    statuses: Array<{ value: CreativeQcStatus; label: string }>;
  };
  summary: Record<string, number>;
  items: CreativeAsset[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  generatedAt: string;
};

export type CreativeAssetsView = 'tiles' | 'table';
