'use client';

import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Send,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Webhook,
} from 'lucide-react';
import { AlertBanner, LoadingCard } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { DashboardTabs } from '@/components/ui/dashboard-tabs';
import { SmsDeviceList } from './sms-device-list';
import { SmsEnrollmentAccess } from './sms-enrollment-access';
import { SmsEnrollmentDialog } from './sms-enrollment-dialog';
import { SmsGettingStarted } from './sms-getting-started';
import { SmsInbox } from './sms-inbox';
import { SmsMetricGrid } from './sms-metric-grid';
import { SmsOperationalSummary } from './sms-operational-summary';
import { SmsSendDialog } from './sms-send-dialog';
import { SmsUsageCards } from './sms-usage-cards';
import { useSmsDashboard } from '../_hooks/use-sms-dashboard';
import { parseSmsError } from '../_utils/sms-errors';

export function SmsDashboardScreen() {
  const [displayName, setDisplayName] = useState('there');
  const [activeTab, setActiveTab] = useState<'overview' | 'inbox'>('overview');
  const controller = useSmsDashboard();
  const {
    access,
    overviewQuery,
    devicesQuery,
    enrollment,
    enrollmentOpen,
    enrollmentCopied,
    enrollmentLoading,
    sendLoading,
    sendOpen,
    checkingDeviceId,
    refreshLoading,
    generateEnrollment,
    openEnrollment,
    copyEnrollment,
    refresh,
    sendMessage,
    checkDeviceHeartbeat,
    setEnrollmentOpen,
    setSendOpen,
  } = controller;

  useEffect(() => {
    try {
      const rawUser = window.localStorage.getItem('user');
      if (!rawUser) return;

      const user = JSON.parse(rawUser) as {
        firstName?: string;
        email?: string;
      };
      setDisplayName(user.firstName?.trim() || user.email?.trim() || 'there');
    } catch {
      setDisplayName('there');
    }
  }, []);

  if (access.isLoading) {
    return <LoadingCard label="Checking SMS access..." />;
  }

  if (!access.canAccessSms) {
    return (
      <AlertBanner
        tone="warning"
        message="You do not have permission to access the SMS workspace."
      />
    );
  }

  if (overviewQuery.isLoading) {
    return <LoadingCard label="Loading SMS workspace..." />;
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <AlertBanner
        tone="error"
        message={parseSmsError(
          overviewQuery.error,
          'SMS overview could not be loaded. Refresh the page.',
        )}
      />
    );
  }

  const overview = overviewQuery.data;
  const devices = devicesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${displayName}`}
        description="Here is what is happening with your SMS gateway."
        actions={
          <>
            {access.canSendMessages ? (
              <Button
                type="button"
                disabled={!overview.setup.hasActiveSim}
                iconLeft={<Send className="h-4 w-4" />}
                title={overview.setup.hasActiveSim ? 'Send an SMS' : 'Connect an active SIM first'}
                onClick={() => setSendOpen(true)}
              >
                Send SMS
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              iconLeft={<ArrowUpRight className="h-4 w-4" />}
              onClick={() => {
                setActiveTab('overview');
                window.requestAnimationFrame(() => {
                  document
                    .getElementById('sms-get-started')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
              }}
            >
              Quick start
            </Button>
            <Button
              type="button"
              variant="outline"
              loading={refreshLoading}
              iconLeft={<RefreshCw className="h-4 w-4" />}
              onClick={() => void refresh()}
            >
              Refresh
            </Button>
            {access.canManageDevices ? (
              <Button
                type="button"
                loading={enrollmentLoading}
                iconLeft={<KeyRound className="h-4 w-4" />}
                onClick={generateEnrollment}
              >
                New enrollment key
              </Button>
            ) : null}
          </>
        }
      />

      <DashboardTabs
        value={activeTab}
        items={[
          {
            value: 'overview',
            label: 'Overview',
            icon: <LayoutDashboard className="h-4 w-4" />,
          },
          ...(access.canReadInbox
            ? [{
                value: 'inbox' as const,
                label: 'Inbox',
                icon: <Inbox className="h-4 w-4" />,
              }]
            : []),
        ]}
        onValueChange={setActiveTab}
      />

      {activeTab === 'inbox' ? (
        <SmsInbox
          enabled={access.canReadInbox}
          canSendMessages={access.canSendMessages}
        />
      ) : (
        <>

      {devicesQuery.isError && access.canReadDevices ? (
        <AlertBanner
          tone="error"
          message="Registered devices could not be loaded. Overview metrics are still available."
        />
      ) : null}

      <SmsGettingStarted
        overview={overview}
        enrollmentGenerated={Boolean(enrollment)}
        canManageDevices={access.canManageDevices}
        enrollmentLoading={enrollmentLoading}
        onGenerateEnrollment={generateEnrollment}
      />

      <SmsUsageCards overview={overview} />

      <SmsMetricGrid overview={overview} />

      <div className="grid gap-6 xl:grid-cols-2">
        {access.canReadDevices ? (
          <SmsDeviceList
            devices={devices}
            canManageDevices={access.canManageDevices}
            enrollmentLoading={enrollmentLoading}
            onGenerateEnrollment={generateEnrollment}
            checkingDeviceId={checkingDeviceId}
            onCheckHeartbeat={checkDeviceHeartbeat}
          />
        ) : (
          <section className="panel panel-content p-5">
            <div className="flex items-start gap-3">
              <Smartphone className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Device details are restricted
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Ask an administrator for SMS inbox or device management access.
                </p>
              </div>
            </div>
          </section>
        )}

        <SmsEnrollmentAccess
          enrollment={enrollment}
          hasRegisteredDevice={overview.setup.hasDevice}
          hasConnectedDevice={overview.setup.hasActiveDevice}
          canManageDevices={access.canManageDevices}
          enrollmentLoading={enrollmentLoading}
          onGenerateEnrollment={generateEnrollment}
          onOpenEnrollment={openEnrollment}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)]">
        <SmsOperationalSummary overview={overview} />

        <section className="panel panel-content">
          <div className="panel-header">
            <Webhook className="panel-icon" />
            <div>
              <h2 className="panel-title">Gateway events</h2>
              <p className="text-xs text-muted">Automatic delivery and inbox synchronization</p>
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-start gap-3 rounded-xl border border-success/25 bg-success-soft p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-success">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Server-managed callbacks
                </p>
                <p className="mt-1 text-sm leading-5 text-muted">
                  Sent, delivered, failed, and inbound SMS events are verified
                  by ERP and recorded under the current partner automatically.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
        </>
      )}

      <SmsEnrollmentDialog
        enrollment={enrollment}
        open={enrollmentOpen}
        copied={enrollmentCopied}
        onCopy={() => void copyEnrollment()}
        onOpenChange={setEnrollmentOpen}
      />

      <SmsSendDialog
        devices={devices}
        loading={sendLoading}
        open={sendOpen}
        onOpenChange={setSendOpen}
        onSend={sendMessage}
      />
    </div>
  );
}
