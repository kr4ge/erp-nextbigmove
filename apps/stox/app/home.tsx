import { Redirect } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from '@/src/features/auth/session-context';
import { InventoryTab } from '@/src/features/home/components/inventory-tab';
import { PackingTab } from '@/src/features/home/components/packing-tab';
import { PickingTab } from '@/src/features/home/components/picking-tab';
import { ScanTab } from '@/src/features/home/components/scan-tab';
import { SettingsTab } from '@/src/features/home/components/settings-tab';
import { StoxShell } from '@/src/features/home/components/stox-shell';
import {
  canEnterStoxWorkspace,
  getAllowedStoxTabs,
  getFallbackStoxTab,
} from '@/src/features/home/rbac';
import type { StoxTabKey } from '@/src/features/home/types';
import { getDisplayName, getInitials, resolveHomeContext } from '@/src/features/home/utils';

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<StoxTabKey>('stock');
  const { bootstrap, device, session, isHydrating, isSubmitting, signOut, refreshBootstrap } = useSession();
  const allowedTabs = useMemo(() => bootstrap ? getAllowedStoxTabs(bootstrap) : ['me' as StoxTabKey], [bootstrap]);

  useEffect(() => {
    if (!bootstrap) {
      return;
    }

    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(getFallbackStoxTab(bootstrap));
    }
  }, [activeTab, allowedTabs, bootstrap]);

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
      title={tabCopy[activeTab].title}
      contextLabel={activeTab === 'me' ? displayName : resolveHomeContext(bootstrap)}
      profileInitials={profileInitials}
      activeTab={activeTab}
      allowedTabs={allowedTabs}
      onChangeTab={setActiveTab}>
      {activeTab === 'stock' ? (
        <InventoryTab
          bootstrap={bootstrap}
          device={device}
          session={session}
          onRefresh={refreshBootstrap}
        />
      ) : null}

      {activeTab === 'scan' ? <ScanTab /> : null}

      {activeTab === 'pick' ? <PickingTab bootstrap={bootstrap} /> : null}

      {activeTab === 'pack' ? <PackingTab /> : null}

      {activeTab === 'me' ? (
        <SettingsTab
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

const tabCopy: Record<StoxTabKey, { title: string }> = {
  stock: { title: 'Stock' },
  scan: { title: 'Scan' },
  pick: { title: 'Pick' },
  pack: { title: 'Pack' },
  me: { title: 'Me' },
};
