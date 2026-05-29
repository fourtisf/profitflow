import { Hanken_Grotesk, IBM_Plex_Mono } from 'next/font/google';

// Defined once so the layout (className) and the share-card canvas (style.fontFamily) use the
// exact same self-hosted font families.
export const sans = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

export const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});
