'use client';
import Link from 'next/link';
import { useState } from 'react';

const LINKS: [string, string][] = [
  ['/#angle', 'Why'],
  ['/#proof', 'Proof'],
  ['/#features', 'Features'],
  ['/leaderboard', 'Leaderboard'],
  ['/#pricing', 'Pricing'],
];

/** Hamburger menu for mobile — the desktop nav links are hidden below 760px. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mnav">
      <button
        type="button"
        className="menu-btn"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '✕' : '☰'}
      </button>
      {open && (
        <div className="menu-panel" onClick={() => setOpen(false)}>
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
          <a href="https://x.com/exitradar_fun" target="_blank" rel="noopener">
            X (Twitter)
          </a>
          <a href="https://t.me/EXITRADAR" target="_blank" rel="noopener">
            Telegram
          </a>
        </div>
      )}
    </div>
  );
}
