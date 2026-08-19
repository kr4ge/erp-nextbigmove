import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Advertising Console',
  description: 'Ad verdicts, spend, and the evaluator',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="text-[15px]" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var root=document.documentElement;if(localStorage.getItem('theme_mode')==='dark'){root.classList.add('dark')}else{root.classList.remove('dark')}}catch(e){}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
