import type { ReactNode } from 'react';
import { SettingsTabs } from './_components/settings-tabs';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <SettingsTabs />
      <div>{children}</div>
    </div>
  );
}
