import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'ERP Analytics Platform',
  description: 'Multi-tenant ERP Analytics & Business Intelligence',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="text-[15px]" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var root=document.documentElement;if(localStorage.getItem('theme_mode')==='dark'){root.classList.add('dark')}else{root.classList.remove('dark')}}catch(e){}})();`,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
