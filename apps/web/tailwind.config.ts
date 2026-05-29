import type { Config } from 'tailwindcss';

// The design system is monochrome + green-only-on-profit. These tokens mirror the approved
// design's CSS variables so Tailwind utilities and the ported component CSS stay in lockstep.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#08090a',
        'bg-2': '#0c0d0f',
        panel: '#0e0f11',
        white: '#fafafa',
        gray: '#a1a1aa',
        muted: '#71717a',
        faint: '#4b4d52',
        green: '#5fd39a',
        'green-dim': '#3f8f69',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
