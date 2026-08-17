export type SmsOverviewResponse = {
  usage: {
    today: {
      sent: number;
      received: number;
      total: number;
      outboundLimit: number;
      outboundRemaining: number;
    };
    last30Days: {
      sent: number;
      received: number;
      total: number;
      outboundCapacity: number;
    };
  };
  stats: {
    totalOutbound: number;
    totalInbound: number;
    totalDevices: number;
    activeDevices: number;
    activeSims: number;
    deliveredMessages: number;
    failedMessages: number;
    pendingMessages: number;
    deliveryRate: number | null;
    lastActivityAt: string | null;
  };
  setup: {
    hasDevice: boolean;
    hasActiveDevice: boolean;
    hasActiveSim: boolean;
    hasSentMessage: boolean;
    hasReceivedMessage: boolean;
  };
};

export type SmsEnrollmentResponse = {
  tenantId: string;
  enrollmentToken: string;
  expiresAt: string;
};

export type SmsSim = {
  id: string;
  subscriptionId: string;
  slotIndex: number;
  phoneNumber: string | null;
  normalizedNumber: string | null;
  alias: string | null;
  carrier: string | null;
  status: 'ACTIVE' | 'OFFLINE' | 'DISABLED';
  lastSeenAt: string | null;
};

export type SmsDevice = {
  id: string;
  externalDeviceId: string;
  name: string;
  status: 'PENDING' | 'ACTIVE' | 'OFFLINE' | 'REVOKED';
  platform: string;
  appVersion: string | null;
  lastSeenAt: string | null;
  enrolledAt: string | null;
  connected: boolean;
  sims: SmsSim[];
};

export type SendSmsMessageInput = {
  recipientPhone: string;
  body: string;
  simId: string;
};

export type SmsMessage = {
  id: string;
  conversationId: string;
  direction: 'OUTBOUND' | 'INBOUND';
  senderPhone: string;
  recipientPhone: string;
  body: string;
  status: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  queuedAt?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  failedAt?: string | null;
  receivedAt?: string | null;
  createdAt: string;
};

export type SmsConversation = {
  id: string;
  customerPhone: string;
  customerPhoneNormalized: string;
  customerName: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  hasUnread: boolean;
  lastReadAt: string | null;
  sim: {
    id: string;
    alias: string | null;
    phoneNumber: string | null;
    carrier: string | null;
    status: SmsSim['status'];
  };
  store: {
    id: string;
    shopName: string;
  } | null;
};

export type SmsHeartbeatResponse = {
  connected: boolean;
  status: 'ACTIVE' | 'OFFLINE';
  requestedAt: string;
  checkedAt: string;
  lastSeenAt: string | null;
};
