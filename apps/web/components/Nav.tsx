import Link from 'next/link';
import { Reticle } from './Logo';
import { MobileMenu } from './MobileMenu';

export function Nav() {
  return (
    <nav>
      <div className="wrap nav-in">
        <Link href="/" className="logo">
          <Reticle size={18} /> ExitRadar
        </Link>
        <div className="nlinks">
          <Link href="/#angle">Why</Link>
          <Link href="/#proof">Proof</Link>
          <Link href="/#features">Features</Link>
          <Link href="/leaderboard">Leaderboard</Link>
          <Link href="/#pricing">Pricing</Link>
        </div>
        <div className="nav-right">
          <span className="ca-pill">
            CA: <b>coming soon</b>
          </span>
          <a
            className="nav-x"
            href="https://x.com/exitradar_fun"
            target="_blank"
            rel="noopener"
            aria-label="ExitRadar on X"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            className="nav-x"
            href="https://t.me/EXITRADAR"
            target="_blank"
            rel="noopener"
            aria-label="ExitRadar on Telegram"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
            </svg>
          </a>
          <Link href="/#waitlist" className="btn btn-w">
            Launch App
          </Link>
          <MobileMenu />
        </div>
      </div>
    </nav>
  );
}
