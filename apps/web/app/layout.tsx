import type { Metadata, Viewport } from 'next';
import './globals.css';
import { mono, sans } from '../lib/fonts';
import { DESCRIPTION, SITE_NAME, SITE_URL, TAGLINE } from '../lib/site';

// OG / twitter:card are mandatory for a share-driven product. The opengraph-image.tsx /
// twitter-image.tsx route handlers generate the actual images from metadataBase.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — track the cash-out`, template: `%s · ${SITE_NAME}` },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ['Solana', 'realized PnL', 'whale tracker', 'memecoin', 'profit', 'on-chain'],
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: TAGLINE,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: TAGLINE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#08090a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
