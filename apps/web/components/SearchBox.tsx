'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Search any Solana address -> wallet or token page. Toggle picks which kind. */
export function SearchBox() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [kind, setKind] = useState<'wallet' | 'token'>('wallet');
  const [err, setErr] = useState(false);

  function go(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!B58.test(v)) {
      setErr(true);
      return;
    }
    router.push(`/${kind}/${v}`);
  }

  return (
    <form className="search" onSubmit={go}>
      <div className="search-toggle">
        <button type="button" className={kind === 'wallet' ? 'on' : ''} onClick={() => setKind('wallet')}>
          Wallet
        </button>
        <button type="button" className={kind === 'token' ? 'on' : ''} onClick={() => setKind('token')}>
          Token
        </button>
      </div>
      <input
        className="search-input"
        value={value}
        spellCheck={false}
        placeholder={`Paste a ${kind} address…`}
        aria-label={`Search ${kind} address`}
        onChange={(e) => {
          setValue(e.target.value);
          if (err) setErr(false);
        }}
      />
      <button type="submit" className="btn btn-w search-go">
        {err ? 'Invalid address' : 'Search'}
      </button>
    </form>
  );
}
