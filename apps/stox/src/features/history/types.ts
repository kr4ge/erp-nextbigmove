export type HistoryActivityFilter = 'ALL' | 'PICK' | 'PACK' | 'DISPATCH' | 'SCAN' | 'VOID' | 'ISSUE';

export type WmsMobileHistoryActorOption = {
  id: string;
  name: string;
  email: string;
  employeeId: string | null;
};

export type WmsMobileHistoryItem = {
  id: string;
  category: 'pick' | 'pack' | 'dispatch' | 'scan' | 'void' | 'issue';
  actionType: string;
  title: string;
  subject: string;
  supporting: string | null;
  occurredAt: string;
  outcome: 'SUCCESS' | 'REJECTED' | 'EXCEPTION';
  actor: {
    id: string | null;
    name: string;
    email: string;
  } | null;
  status: {
    from: string | null;
    to: string | null;
  };
};

export type WmsMobileHistoryFeedResponse = {
  tenantReady: boolean;
  serverTime: string;
  items: WmsMobileHistoryItem[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
  filters: {
    canViewAll: boolean;
    activeActorId: string | null;
    activeType: HistoryActivityFilter;
    actorOptions: WmsMobileHistoryActorOption[];
  };
};
