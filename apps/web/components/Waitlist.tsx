'use client';
import { useState } from 'react';

export function Waitlist() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; created?: boolean };
      if (res.ok) {
        setErr(false);
        setMsg(data.created === false ? "You're already on the list." : "You're in. We'll email you at launch.");
        setEmail('');
      } else {
        setErr(true);
        setMsg(typeof data.error === 'string' ? data.error : 'Something went wrong.');
      }
    } catch {
      setErr(true);
      setMsg('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="waitlist">
      <div className="wrap angle">
        <div className="kicker">Early access</div>
        <h2>Get the feed before everyone else.</h2>
        <p>
          Drop your email and we&apos;ll let you in as we open seats — early users get Pro features
          on the house.
        </p>
        <form className="wait" onSubmit={onSubmit}>
          <input
            type="email"
            required
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email address"
          />
          <button className="btn btn-w" type="submit" disabled={busy}>
            {busy ? 'Joining…' : 'Join waitlist'}
          </button>
        </form>
        <div className={`wait-msg ${err ? 'err' : ''}`}>{msg}</div>
      </div>
    </section>
  );
}
