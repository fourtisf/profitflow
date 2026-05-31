import Link from 'next/link';
import { Reticle } from './Logo';

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
        <Link href="/#waitlist" className="btn btn-w">
          Launch App
        </Link>
      </div>
    </nav>
  );
}
