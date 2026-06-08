import { Redirect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSession } from '@/src/features/auth/session-context';
import { AccountTab } from '@/src/features/home/components/account-tab';
import { HistoryTab } from '@/src/features/home/components/history-tab';
import { HomeOverviewTab } from '@/src/features/home/components/home-overview-tab';
import { InventoryUtilityTab } from '@/src/features/home/components/inventory-utility-tab';
import { ScanTab } from '@/src/features/home/components/scan-tab';
import { StoxShell } from '@/src/features/home/components/stox-shell';
import { TasksTab } from '@/src/features/home/components/tasks-tab';
import { canEnterStoxWorkspace } from '@/src/features/home/rbac';
import type { InventoryTaskView, StoxTabKey, StoxTaskMode, StoxTaskRoute } from '@/src/features/home/types';
import { getDisplayName, getInitials, resolveHomeContext } from '@/src/features/home/utils';
import type { WmsMobilePickingTask } from '@/src/features/picking/types';
import type { WmsMobileTrackingReturnFlow } from '@/src/features/stock/types';

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<StoxTabKey>('home');
  const [homePanel, setHomePanel] = useState<'overview' | 'inventory-utility'>('overview');
  const [taskRoute, setTaskRoute] = useState<StoxTaskRoute | null>(null);
  const { bootstrap, device, session, isHydrating, isSubmitting, signOut, refreshBootstrap } = useSession();
  const openInventoryRts = useCallback((
    task: WmsMobilePickingTask | null = null,
    returnFlow: WmsMobileTrackingReturnFlow | null = null,
  ) => {
    setTaskRoute({
      inventoryView: 'rts',
      key: Date.now(),
      mode: 'inventory',
      rtsReturnFlow: returnFlow,
      rtsTask: task,
    });
    setActiveTab('tasks');
    setHomePanel('overview');
  }, []);
  const openTaskRoute = useCallback((route: { inventoryView?: InventoryTaskView; mode: StoxTaskMode }) => {
    setTaskRoute({
      inventoryView: route.inventoryView,
      key: Date.now(),
      mode: route.mode,
    });
    setActiveTab('tasks');
    setHomePanel('overview');
  }, []);

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
        || activeTab === 'account'
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
            onOpenStock={() => setHomePanel('inventory-utility')}
            onOpenTaskRoute={openTaskRoute}
            onOpenRts={() => openInventoryRts()}
          />
        ) : (
          <InventoryUtilityTab
            bootstrap={bootstrap}
            device={device}
            session={session}
            onBack={() => setHomePanel('overview')}
            onRefresh={refreshBootstrap}
            onOpenRts={() => openInventoryRts()}
          />
        )
      ) : null}

      {activeTab === 'tasks' ? (
        <TasksTab
          bootstrap={bootstrap}
          device={device}
          session={session}
          onRefresh={refreshBootstrap}
          route={taskRoute}
          onRouteConsumed={() => setTaskRoute(null)}
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
            openInventoryRts(task, returnFlow);
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
