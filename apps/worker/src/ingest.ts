import http from 'node:http';
import express from 'express';
import { config, shortWallet, tierFor, type RealizedExit, type Source } from '@profitflow/shared';
import type { PositionEvent } from '@profitflow/pnl-engine';
import { env } from './env';
import { extractLegs, EPSILON, type HeliusTx } from './parse';
import type { PriceSource } from './price';
import type { PositionStore } from './positions';
import type { Emitter } from './emit';
import type { Universe } from './universe';

interface Deps {
  price: PriceSource;
  positions: PositionStore;
  emitter: Emitter;
  universe: Universe;
}

function mapSource(src?: string): Source {
  const s = (src ?? '').toUpperCase();
  if (s.includes('PUMP')) return 'pump.fun';
  if (s.includes('METEORA')) return 'Meteora';
  return 'Raydium';
}

// Same classification as validate.js, but value-leg USD is already computed (per-timestamp priced).
function classifyEvent(tokenDelta: number, valueUsd: number, ts: number, sig: string): PositionEvent {
  if (tokenDelta > 0 && valueUsd < -EPSILON) return { kind: 'buy', amount: tokenDelta, usd: -valueUsd, ts, sig };
  if (tokenDelta < 0 && valueUsd > EPSILON) return { kind: 'sell', amount: -tokenDelta, usd: valueUsd, ts, sig };
  if (tokenDelta > 0) return { kind: 'transfer_in', amount: tokenDelta, ts, sig };
  return { kind: 'transfer_out', amount: -tokenDelta, ts, sig };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export class HeliusIngest {
  private server: http.Server | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private seen = new Set<string>(); // in-process dedupe; PG ON CONFLICT is the durable guard
  private readonly symbolCache = new Map<string, string>(); // mint -> "$SYMBOL"

  constructor(private readonly deps: Deps) {}

  /** Process one enhanced tx for one wallet: parse -> price -> engine -> emit if it clears. */
  async processTx(tx: HeliusTx, wallet: string): Promise<void> {
    const dedupeKey = `${tx.signature}:${wallet}`;
    if (this.seen.has(dedupeKey)) return;
    this.seen.add(dedupeKey);

    const legs = extractLegs(tx, wallet);
    if (!legs.mints.size) return;

    const solUsd = legs.solLamports !== 0 ? await this.deps.price.solUsd(legs.ts) : 0;
    // Wallet net value leg (+received / -paid). NB: with multiple mints in one tx this is shared
    // across them (approximate); simple swaps move a single token.
    const valueUsd = legs.stableUsd + (legs.solLamports / 1e9) * solUsd;

    for (const [mint, tokenDelta] of legs.mints) {
      if (!this.deps.universe.allows(mint)) continue;
      const event = classifyEvent(tokenDelta, valueUsd, legs.ts, legs.sig);
      const applied = await this.deps.positions.apply(wallet, mint, event);

      if (event.kind === 'sell' && applied.realizedThisEvent >= config.proMinUsd) {
        const exit: RealizedExit = {
          id: legs.sig,
          sig: legs.sig,
          ts: legs.ts * 1000,
          ticker: await this.tokenSymbol(mint),
          mint,
          wallet,
          walletShort: shortWallet(wallet),
          entryUsd: round2(applied.entryUsd), // keep cents — memecoin buys are often sub-dollar
          proceedsUsd: Math.round(applied.proceedsUsd),
          pnlUsd: Math.round(applied.realizedThisEvent),
          multiple: applied.multiple,
          source: mapSource(tx.source),
          unverifiedBasis: applied.unverifiedBasis,
          tier: tierFor(applied.realizedThisEvent),
        };
        await this.deps.emitter.emit(exit);
      }
    }
  }

  private async fetchRecent(addr: string): Promise<HeliusTx[]> {
    const url = `https://api.helius.xyz/v0/addresses/${addr}/transactions?api-key=${env.heliusApiKey}&limit=100`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Helius ${res.status}: ${await res.text()}`);
    return (await res.json()) as HeliusTx[];
  }

  /** Resolve a mint's real symbol via Helius DAS getAsset (cached). Falls back to the mint prefix. */
  private async tokenSymbol(mint: string): Promise<string> {
    const cached = this.symbolCache.get(mint);
    if (cached) return cached;
    let ticker = '$' + mint.slice(0, 4).toUpperCase(); // fallback when metadata is missing
    try {
      const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${env.heliusApiKey}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAsset', params: { id: mint } }),
      });
      const j = (await res.json()) as {
        result?: { token_info?: { symbol?: string }; content?: { metadata?: { symbol?: string } } };
      };
      const sym = j.result?.token_info?.symbol ?? j.result?.content?.metadata?.symbol;
      if (sym && sym.trim()) ticker = '$' + sym.trim().replace(/^\$/, '').toUpperCase().slice(0, 12);
    } catch {
      /* keep fallback */
    }
    this.symbolCache.set(mint, ticker);
    return ticker;
  }

  startPolling(): void {
    if (!env.watchAddresses.length) {
      console.log('[ingest] polling idle: no WATCH_ADDRESSES set (use Helius webhooks at scale).');
      return;
    }
    const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
    console.log(
      `[ingest] polling ${env.watchAddresses.length} wallets, ${env.pollSpacingMs}ms apart, every ${Math.round(env.pollIntervalMs / 1000)}s`,
    );
    const tick = async (): Promise<void> => {
      for (const addr of env.watchAddresses) {
        try {
          const txs = await this.fetchRecent(addr);
          for (const tx of txs.sort((a, b) => a.timestamp - b.timestamp)) await this.processTx(tx, addr);
          await sleep(env.pollSpacingMs); // throttle so we stay under Helius rate limits
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error('[ingest] poll failed for', addr, '-', msg);
          await sleep(msg.includes('429') ? 5_000 : env.pollSpacingMs); // back off hard on rate limit
        }
      }
      this.pollTimer = setTimeout(() => void tick(), env.pollIntervalMs);
    };
    void tick();
  }

  startWebhook(): void {
    const app = express();
    app.use(express.json({ limit: '4mb' }));
    app.get('/health', (_req, res) => res.json({ ok: true }));
    app.post('/webhook', (req, res) => {
      const txs = (Array.isArray(req.body) ? req.body : [req.body]) as HeliusTx[];
      // Helius webhooks are configured per watched address; attribute each tx to those wallets.
      void (async () => {
        for (const tx of txs) for (const addr of env.watchAddresses) await this.processTx(tx, addr);
      })();
      res.json({ received: txs.length });
    });
    this.server = http.createServer(app);
    this.server.listen(env.webhookPort, () => console.log(`[ingest] webhook on :${env.webhookPort}/webhook`));
  }

  async stop(): Promise<void> {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.server?.close();
  }
}
