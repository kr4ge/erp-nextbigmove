'use client';

import type { ReactNode } from 'react';
import { WmsShell } from './_components/wms-shell';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <WmsShell>{children}</WmsShell>;
}
