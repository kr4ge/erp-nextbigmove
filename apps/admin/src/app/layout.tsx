import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'ERP WMS Workspace',
  description: 'Warehouse operating system workspace for ERP stock-truth foundations',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="wms-density-default">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
