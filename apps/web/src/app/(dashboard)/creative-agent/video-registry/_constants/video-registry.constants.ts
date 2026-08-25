import type {
  CreativePerformanceStatus,
  CreativeQcStatus,
  GetVideoRegistryParams,
} from '../_types/video-registry';

export const QC_STATUS_LABELS: Record<CreativeQcStatus, string> = {
  DRAFT: 'Draft',
  FOR_APPROVAL: 'For approval',
  FOR_REVISION: 'For revision',
  REVISED: 'Revised',
  FOR_POSTING: 'For posting',
  POSTED: 'Posted',
  CANCELLED: 'Cancelled',
};

export const PERFORMANCE_STATUS_LABELS: Record<CreativePerformanceStatus, string> = {
  DRAFT: 'Draft',
  LIVE: 'Live',
  WINNER: 'Winner',
  FATIGUED: 'Fatigued',
  RETIRED: 'Retired',
};

export const VIDEO_FORMAT_OPTIONS = [
  { value: 'UGC', label: 'UGC' },
  { value: 'TESTIMONIAL', label: 'Testimonial' },
  { value: 'PRODUCT_DEMO', label: 'Product demo' },
  { value: 'PROBLEM_SOLUTION', label: 'Problem / solution' },
];

export const STATIC_FORMAT_OPTIONS = [
  { value: 'PRODUCT_IMAGE', label: 'Product image' },
  { value: 'LIFESTYLE', label: 'Lifestyle' },
  { value: 'GRAPHIC', label: 'Graphic' },
  { value: 'TESTIMONIAL_GRAPHIC', label: 'Testimonial graphic' },
  { value: 'CAROUSEL_FRAME', label: 'Carousel frame' },
];

export const HOOK_TYPE_OPTIONS = [
  { value: 'PAIN_POINT', label: 'Pain point' },
  { value: 'CURIOSITY', label: 'Curiosity' },
  { value: 'SOCIAL_PROOF', label: 'Social proof' },
  { value: 'BEFORE_AFTER', label: 'Before / after' },
];

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 29);

export const DEFAULT_VIDEO_REGISTRY_PARAMS: GetVideoRegistryParams = {
  startDate: toDateInputValue(thirtyDaysAgo),
  endDate: toDateInputValue(today),
  query: '',
  kind: '',
  accountId: '',
  storeId: '',
  creatorId: '',
  qcStatus: '',
  performanceStatus: '',
  page: 1,
  pageSize: 10,
  unregisteredPage: 1,
  unregisteredPageSize: 5,
  sortKey: 'code',
  sortDirection: 'desc',
};
