import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import type { ReactNode } from 'react';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Warehouse Connex',
  description: 'Internal warehouse and partner operations workspace for the ERP platform.',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className="text-[15px]">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
