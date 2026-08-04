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
  sims: SmsSim[];
};

export type SendSmsMessageInput = {
  recipientPhone: string;
  body: string;
  simId: string;
};

export type SmsMessage = {
  id: string;
  recipientPhone: string;
  body: string;
  status: string;
  createdAt: string;
};
