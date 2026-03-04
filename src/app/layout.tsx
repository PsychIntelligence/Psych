import type { Metadata, Viewport } from 'next';
import { Inter_Tight, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { CatEmotionProvider } from '@/components/cat/CatEmotionProvider';
import Background from '@/components/visual/Background';
import ThemeEffect from '@/components/shared/ThemeEffect';
import './globals.css';

const sans = Inter_Tight({
  subsets: ['latin'], variable: '--font-sans', display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});
const serif = Instrument_Serif({
  subsets: ['latin'], variable: '--font-serif', display: 'swap', weight: '400',
});
const mono = JetBrains_Mono({
  subsets: ['latin'], variable: '--font-mono', display: 'swap', weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'psych | Solana Trading Psychology',
  description: 'On-chain behavioral intelligence for Solana traders.',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a11',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body className="font-sans antialiased min-h-screen">
        <CatEmotionProvider>
          <ThemeEffect />
          <Background />
          {children}
        </CatEmotionProvider>
      </body>
    </html>
  );
}
