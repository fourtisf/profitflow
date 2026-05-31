import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';
import { config, type DataSource, type LeaderboardRange, type Tier } from '@profitflow/shared';
import { env } from './env';
import { createInMemoryFollows, createInMemoryWaitlist, isEmail } from './store';

function resolveTier(req: Request): Tier {
  const raw = (req.query.tier as string | undefined) ?? req.header('x-pf-tier') ?? 'free';
  return raw === 'pro' ? 'pro' : 'free';
}

function userKey(req: Request): string {
  // No auth yet. Monetization = subscription, so real auth/billing (Stripe) gets wired before Pro
  // sign-ups. Until then, key follows by an opaque header or the request IP.
  return req.header('x-pf-user') ?? req.ip ?? 'anon';
}

function clampInt(v: unknown, def: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function createApp(ds: DataSource): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use(
    cors({
      origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((s) => s.trim()),
    }),
  );

  const waitlist = createInMemoryWaitlist();
  const follows = createInMemoryFollows();
  const startedAt = Date.now();

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, source: ds.name, uptimeMs: Date.now() - startedAt });
  });

  app.get('/api/config', (_req: Request, res: Response) => {
    res.json({ source: ds.name, freeMinUsd: config.freeMinUsd, proMinUsd: config.proMinUsd });
  });

  // Recent realized exits, tier-gated (free sees >= freeMin; pro sees down to proMin).
  app.get('/api/feed/recent', (req: Request, res: Response) => {
    const tier = resolveTier(req);
    const limit = clampInt(req.query.limit, 50, 1, 200);
    res.json({ tier, exits: ds.getRecent({ tier, limit }) });
  });

  // Leaderboard: trader of the week / all-time.
  app.get('/api/leaderboard', (req: Request, res: Response) => {
    const range: LeaderboardRange = req.query.range === 'all' ? 'all' : 'week';
    const limit = clampInt(req.query.limit, 20, 1, 100);
    res.json({ range, entries: ds.getLeaderboard(range, limit) });
  });

  // A wallet's realized history (within the current window).
  app.get('/api/wallet/:address', (req: Request, res: Response) => {
    const profile = ds.getWallet(req.params.address);
    if (!profile) {
      res.status(404).json({ error: 'wallet not found in current window' });
      return;
    }
    res.json(profile);
  });

  // A token's realized cash-outs across every wallet (within the current window).
  app.get('/api/token/:mint', (req: Request, res: Response) => {
    const profile = ds.getToken(req.params.mint);
    if (!profile) {
      res.status(404).json({ error: 'token not found in current window' });
      return;
    }
    res.json(profile);
  });

  // Smart-money signal: tokens being distributed — many wallets cashing out in a short window.
  app.get('/api/signals', (req: Request, res: Response) => {
    const minWallets = clampInt(req.query.minWallets, 3, 2, 20);
    res.json({ signals: ds.getSignals({ minWallets }) });
  });

  // Waitlist capture (email -> store). In-memory now; Postgres-backed when DATABASE_URL is set.
  app.post('/api/waitlist', async (req: Request, res: Response) => {
    const email = String(req.body?.email ?? '');
    if (!isEmail(email)) {
      res.status(400).json({ error: 'a valid email is required' });
      return;
    }
    const { created, total } = await waitlist.add(email);
    res.status(created ? 201 : 200).json({ ok: true, created, total });
  });

  // ── M4: wallet follow + alerts (alert delivery via ws/bot comes later) ──────
  app.get('/api/follows', async (req: Request, res: Response) => {
    res.json({ wallets: await follows.list(userKey(req)) });
  });
  app.post('/api/follows', async (req: Request, res: Response) => {
    const wallet = String(req.body?.wallet ?? '');
    if (!wallet) {
      res.status(400).json({ error: 'wallet required' });
      return;
    }
    res.json({ wallets: await follows.follow(userKey(req), wallet) });
  });
  app.delete('/api/follows/:wallet', async (req: Request, res: Response) => {
    res.json({ wallets: await follows.unfollow(userKey(req), req.params.wallet) });
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'not found' });
  });

  return app;
}
