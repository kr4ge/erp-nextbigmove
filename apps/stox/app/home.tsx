import { Redirect } from 'expo-router';
import { useState } from 'react';
import { useSession } from '@/src/features/auth/session-context';
import { AccountTab } from '@/src/features/home/components/account-tab';
import { HistoryTab } from '@/src/features/home/components/history-tab';
import { HomeOverviewTab } from '@/src/features/home/components/home-overview-tab';
import { InventoryTab } from '@/src/features/home/components/inventory-tab';
import { RtsTab } from '@/src/features/home/components/rts-tab';
import { ScanTab } from '@/src/features/home/components/scan-tab';
import { StoxShell } from '@/src/features/home/components/stox-shell';
import { TasksTab } from '@/src/features/home/components/tasks-tab';
import { canEnterStoxWorkspace } from '@/src/features/home/rbac';
import type { StoxTabKey } from '@/src/features/home/types';
import { getDisplayName, getInitials, resolveHomeContext } from '@/src/features/home/utils';
import type { WmsMobilePickingTask } from '@/src/features/picking/types';
import type { WmsMobileTrackingReturnFlow } from '@/src/features/stock/types';

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<StoxTabKey>('home');
  const [homePanel, setHomePanel] = useState<'overview' | 'stock' | 'rts'>('overview');
  const [rtsSeedTask, setRtsSeedTask] = useState<WmsMobilePickingTask | null>(null);
  const [rtsSeedReturnFlow, setRtsSeedReturnFlow] = useState<WmsMobileTrackingReturnFlow | null>(null);
  const { bootstrap, device, session, isHydrating, isSubmitting, signOut, refreshBootstrap } = useSession();

  if (!isHydrating && (!session || !bootstrap || !canEnterStoxWorkspace(bootstrap))) {
    return <Redirect href="/login" />;
  }

  if (!bootstrap || !session) {
    return null;
  }

  const displayName = getDisplayName(bootstrap.user);
  const profileInitials = getInitials(displayName);

  return (
    <StoxShell
      contextLabel={resolveHomeContext(bootstrap)}
      displayName={displayName}
      profileInitials={profileInitials}
      activeTab={activeTab}
      hideHeader={
        activeTab === 'home'
        || activeTab === 'tasks'
        || activeTab === 'scan'
        || activeTab === 'history'
      }
      onChangeTab={(nextTab) => {
        setActiveTab(nextTab);
        if (nextTab === 'home') {
          setHomePanel('overview');
        }
      }}>
      {activeTab === 'home' ? (
        homePanel === 'overview' ? (
          <HomeOverviewTab
            bootstrap={bootstrap}
            device={device}
            session={session}
            onChangeTab={setActiveTab}
            onOpenStock={() => setHomePanel('stock')}
            onOpenRts={() => {
              setRtsSeedTask(null);
              setRtsSeedReturnFlow(null);
              setHomePanel('rts');
            }}
          />
        ) : homePanel === 'stock' ? (
          <InventoryTab
            bootstrap={bootstrap}
            device={device}
            onOpenRts={() => {
              setRtsSeedTask(null);
              setRtsSeedReturnFlow(null);
              setHomePanel('rts');
            }}
            session={session}
            onRefresh={refreshBootstrap}
            onBack={() => setHomePanel('overview')}
          />
        ) : (
          <RtsTab
            bootstrap={bootstrap}
            device={device}
            initialReturnFlow={rtsSeedReturnFlow}
            initialTask={rtsSeedTask}
            session={session}
            onRefresh={refreshBootstrap}
            onBack={() => setHomePanel('stock')}
          />
        )
      ) : null}

      {activeTab === 'tasks' ? (
        <TasksTab
          bootstrap={bootstrap}
          device={device}
          session={session}
        />
      ) : null}

      {activeTab === 'scan' ? (
        <ScanTab
          bootstrap={bootstrap}
          device={device}
          session={session}
          onRefresh={refreshBootstrap}
          onChangeTab={setActiveTab}
          onOpenRtsTask={(task, returnFlow) => {
            setRtsSeedTask(task);
            setRtsSeedReturnFlow(returnFlow);
            setActiveTab('home');
            setHomePanel('rts');
          }}
        />
      ) : null}

      {activeTab === 'history' ? (
        <HistoryTab
          bootstrap={bootstrap}
          device={device}
          session={session}
        />
      ) : null}

      {activeTab === 'account' ? (
        <AccountTab
          bootstrap={bootstrap}
          device={device}
          isSubmitting={isSubmitting}
          session={session}
          onRefresh={refreshBootstrap}
          onSignOut={signOut}
        />
      ) : null}
    </StoxShell>
  );
}
