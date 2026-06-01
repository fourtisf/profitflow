// ExitRadar alert bot (interactive + channel). Users DM the bot to follow Solana wallets; the
// moment a followed wallet cashes out, they get a DM. Data flows: worker (Helius) -> Redis exits
// channel -> this bot -> Telegram DM. Follows live in Redis so the worker dynamically tracks them.
//
// When TELEGRAM_CHANNEL_ID is set the same bot also drives the public channel (@EXITRADAR):
//   • big-exit broadcast   — exits >= CHANNEL_MIN_USD, in real time
//   • smart-money signals  — many distinct wallets dumping one token (deduped, polled)
//   • daily digest         — 24h totals + the biggest exit
//   • leaderboard          — top realized traders (range configurable)
//   • weekly recap         — Mondays, the week's biggest winners
// Scheduling is cron-like (wall-clock anchors) and idempotent via Redis SET NX guards, so pm2
// restarts never double-post.
//
// Redis keys:
//   er:watch          SET     every followed wallet (the worker polls this ∪ WATCH_ADDRESSES)
//   er:fw:<wallet>    SET     chat IDs following that wallet
//   er:fu:<chatId>    SET     wallets that user follows
//   er:post:<bucket>  STRING  "posted once per period" guard (NX + TTL)
//   er:sig:<mint>     STRING  last signal strength (wallet count) posted for a token
//
// Run: TELEGRAM_BOT_TOKEN=... REDIS_URL=redis://127.0.0.1:6380 node dist/alert-bot.js
import Redis from 'ioredis';
import { fullUsd } from '@profitflow/shared';
import { env } from './env';

const TOKEN = env.telegramToken;
if (!TOKEN) {
  console.error('[alert-bot] TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}
if (!env.redisUrl) {
  console.error('[alert-bot] REDIS_URL is required (point it at the worker’s Redis)');
  process.exit(1);
}

const CHANNEL = env.telegramChannelId; // falsy => channel features off
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const short = (w: string): string => (w.length > 9 ? `${w.slice(0, 4)}…${w.slice(-4)}` : w);
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const redis = new Redis(env.redisUrl, { maxRetriesPerRequest: 3 });
const sub = new Redis(env.redisUrl, { maxRetriesPerRequest: 3 });
redis.on('error', (e) => console.error('[alert-bot] redis:', e.message));
sub.on('error', (e) => console.error('[alert-bot] redis(sub):', e.message));

let botUsername = env.botUsername; // refined via getMe at boot

// ── Telegram helpers ─────────────────────────────────────────────────────────
async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!j.ok) throw new Error(`${method}: ${j.description ?? res.status}`);
  return j.result as T;
}

type InlineButton = { text: string; url: string };
function markup(...rows: InlineButton[][]): Record<string, unknown> {
  return { reply_markup: { inline_keyboard: rows } };
}

function send(
  chatId: number | string,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<unknown> {
  return tg('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...extra,
  }).catch((e) => console.error('[alert-bot] send failed:', e instanceof Error ? e.message : e));
}

// "Track this wallet" deep-link → opens the bot and auto-follows on /start.
function trackWalletBtn(wallet: string): InlineButton {
  return { text: '🔔 Track this wallet', url: `https://t.me/${botUsername}?start=follow_${wallet}` };
}
function siteBtn(text: string, path: string): InlineButton {
  return { text, url: `https://exitradar.fun${path}` };
}

// ── Display helpers (hide unverified-basis artifacts) ─────────────────────────
// A "multiple" above maxSaneMultiple almost always means cost basis ≈ 0 (unverified) — hide it
// rather than print a nonsense "8657×".
function multipleTag(m: number | null | undefined, sep = ' '): string {
  if (m == null || !Number.isFinite(m) || m <= 0 || m > env.maxSaneMultiple) return '';
  return `${sep}${m.toFixed(1)}×`;
}
function tickerLabel(t: string | null | undefined): string {
  const s = (t ?? '').trim();
  return s ? s.replace(/^\$?/, '$') : '';
}
function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
// "$GIGA" with a guaranteed leading $, or a placeholder when the ticker is missing.
function tk(t: string | null | undefined): string {
  return tickerLabel(t) || '$???';
}
function ago(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Interactive commands (DM) ─────────────────────────────────────────────────
const HELP =
  '👋 <b>ExitRadar alerts</b>\n\n' +
  "Follow any Solana wallet — I'll DM you the moment it cashes out. 💸\n\n" +
  '<b>Alerts</b>\n' +
  '<b>/follow</b> &lt;wallet&gt; — track a wallet\n' +
  '<b>/unfollow</b> &lt;wallet&gt; — stop tracking\n' +
  '<b>/following</b> — your watchlist\n\n' +
  '<b>Explore</b>\n' +
  '<b>/leaderboard</b> [week|all] — top realized traders\n' +
  '<b>/signals</b> — smart-money distribution right now\n' +
  '<b>/recent</b> — latest big cash-outs\n' +
  '<b>/stats</b> — 24h market digest\n' +
  '<b>/wallet</b> &lt;address&gt; — a wallet’s realized PnL\n' +
  '<b>/token</b> &lt;mint&gt; — a token’s cash-outs\n\n' +
  'Full terminal → exitradar.fun';

// Registered with BotFather (setMyCommands) so the "/" menu + Menu button populate.
const COMMANDS = [
  { command: 'follow', description: 'Track a wallet — DM when it cashes out' },
  { command: 'unfollow', description: 'Stop tracking a wallet' },
  { command: 'following', description: 'Your watchlist' },
  { command: 'leaderboard', description: 'Top realized traders (week|all)' },
  { command: 'signals', description: 'Smart-money distribution right now' },
  { command: 'recent', description: 'Latest big cash-outs' },
  { command: 'stats', description: '24h market digest' },
  { command: 'wallet', description: "A wallet's realized PnL" },
  { command: 'token', description: "A token's cash-outs" },
  { command: 'help', description: 'Show all commands' },
];

async function doFollow(chatId: number, wallet: string): Promise<void> {
  await redis.sadd('er:watch', wallet);
  await redis.sadd(`er:fw:${wallet}`, String(chatId));
  await redis.sadd(`er:fu:${chatId}`, wallet);
  await send(
    chatId,
    `✅ Following <b>${short(wallet)}</b>.\nI'll ping you the moment it cashes out.`,
    markup([siteBtn('📊 Wallet page', `/wallet/${wallet}`)]),
  );
}

async function handle(chatId: number, text: string): Promise<void> {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0]!.toLowerCase().replace(/@.*$/, ''); // strip @botname mentions
  const arg = parts[1];

  if (cmd === '/start') {
    // Deep-link: /start follow_<wallet> (from a channel "track this wallet" button).
    if (arg?.startsWith('follow_')) {
      const wallet = arg.slice('follow_'.length);
      if (B58.test(wallet)) return void doFollow(chatId, wallet);
    }
    return void send(chatId, HELP);
  }
  if (cmd === '/help') return void send(chatId, HELP);

  if (cmd === '/follow') {
    if (!arg || !B58.test(arg)) return void send(chatId, '⚠️ Usage: <code>/follow &lt;wallet address&gt;</code>');
    return void doFollow(chatId, arg);
  }

  if (cmd === '/unfollow') {
    if (!arg) return void send(chatId, '⚠️ Usage: <code>/unfollow &lt;wallet&gt;</code>');
    await redis.srem(`er:fw:${arg}`, String(chatId));
    await redis.srem(`er:fu:${chatId}`, arg);
    if ((await redis.scard(`er:fw:${arg}`)) === 0) await redis.srem('er:watch', arg);
    return void send(chatId, `🚫 Unfollowed <b>${short(arg)}</b>.`);
  }

  if (cmd === '/following') {
    const ws = await redis.smembers(`er:fu:${chatId}`);
    if (!ws.length) return void send(chatId, "You're not following any wallets yet.\nTry <code>/follow &lt;wallet&gt;</code>");
    return void send(chatId, '👀 <b>Following</b>\n' + ws.map((w) => `• <code>${short(w)}</code>`).join('\n'));
  }

  if (cmd === '/leaderboard') {
    const range = arg === 'all' ? 'all' : 'week';
    const text2 = await leaderboardText(range).catch(() => null);
    return void send(chatId, text2 ?? 'No realized trades in the window yet — check back soon.', markup([siteBtn('📊 Full leaderboard', '/leaderboard')]));
  }

  if (cmd === '/signals') {
    const text2 = await signalsText().catch(() => null);
    return void send(chatId, text2 ?? '🛰️ Quiet right now — no cluster exits in the last few hours.', markup([siteBtn('📊 Open ExitRadar', '/')]));
  }

  if (cmd === '/recent') {
    const text2 = await recentText().catch(() => null);
    return void send(chatId, text2 ?? 'No recent exits in the window yet.', markup([siteBtn('📊 Live feed', '/')]));
  }

  if (cmd === '/stats') {
    const d = await buildDigest().catch(() => null);
    return void send(chatId, d?.text ?? 'No exits in the last 24h yet — check back soon.', markup([siteBtn('📊 Leaderboard', '/leaderboard')]));
  }

  if (cmd === '/wallet') {
    if (!arg || !B58.test(arg)) return void send(chatId, '⚠️ Usage: <code>/wallet &lt;address&gt;</code>');
    const text2 = await walletText(arg).catch(() => null);
    return void send(
      chatId,
      text2 ?? `No realized exits for <b>${short(arg)}</b> in the current window.`,
      markup([trackWalletBtn(arg), siteBtn('📊 Wallet page', `/wallet/${arg}`)]),
    );
  }

  if (cmd === '/token') {
    if (!arg || !B58.test(arg)) return void send(chatId, '⚠️ Usage: <code>/token &lt;mint address&gt;</code>');
    const text2 = await tokenText(arg).catch(() => null);
    return void send(
      chatId,
      text2 ?? `No cash-outs for that token in the current window.`,
      markup([siteBtn('📊 Token page', `/token/${arg}`)]),
    );
  }

  return void send(chatId, 'Unknown command. Try /help');
}

// ── Real-time exit relay (DM followers + big-exit channel broadcast) ──────────
interface ExitRow {
  sig: string;
  ts: number;
  ticker: string;
  mint: string;
  wallet: string;
  wallet_short: string;
  pnl_usd: number;
  multiple: number | null;
}

function exitText(row: ExitRow): string {
  const tk = tickerLabel(row.ticker) || '$' + (row.ticker || '???');
  return (
    `🚨 <b>${row.wallet_short}</b> cashed out <b>${tk}</b>\n` +
    `💸 +${fullUsd(row.pnl_usd)}${multipleTag(row.multiple, ' · ')}\n` +
    `🔗 <a href="https://solscan.io/tx/${row.sig}">verify</a> · ` +
    `<a href="https://exitradar.fun/wallet/${row.wallet}">wallet</a>`
  );
}

async function onExit(row: ExitRow): Promise<void> {
  const text = exitText(row);

  // 1) DM every follower of this wallet.
  const followers = await redis.smembers(`er:fw:${row.wallet}`);
  for (const chatId of followers) await send(chatId, text);

  // 2) Broadcast big exits to the public channel (independent of followers).
  if (CHANNEL && row.pnl_usd >= env.channelMinUsd) {
    await send(CHANNEL, text, markup([trackWalletBtn(row.wallet)]));
  }
}

// ── Channel auto-content ──────────────────────────────────────────────────────
const MEDALS = ['🥇', '🥈', '🥉'];

interface LeaderboardEntryDto {
  wallet: string;
  walletShort: string;
  realizedUsd: number;
  exits: number;
  bestMultiple: number | null;
  topTicker: string;
}
interface ExitDto {
  sig: string;
  ts: number;
  ticker: string;
  mint: string;
  wallet: string;
  walletShort: string;
  pnlUsd: number;
  multiple: number | null;
}
interface SignalDto {
  mint: string;
  ticker: string;
  wallets: number;
  exits: number;
  realizedUsd: number;
  windowMs: number;
}
interface WalletDto {
  walletShort: string;
  realizedUsd: number;
  bestMultiple: number | null;
  lastSeen: number;
  exits: ExitDto[];
}
interface TokenDto {
  ticker: string;
  realizedUsd: number;
  exitsCount: number;
  walletsCount: number;
  bestMultiple: number | null;
  topExitUsd: number;
  lastSeen: number;
  exits: ExitDto[];
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${env.apiUrl}${path}`);
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

// Like api(), but a 404 (wallet/token not in window) resolves to null instead of throwing.
async function apiMaybe<T>(path: string): Promise<T | null> {
  const res = await fetch(`${env.apiUrl}${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function leaderboardText(range: 'week' | 'all' = env.leaderboardRange): Promise<string | null> {
  const { entries = [] } = await api<{ entries?: LeaderboardEntryDto[] }>(
    `/api/leaderboard?range=${range}&limit=${env.leaderboardTopN}`,
  );
  if (!entries.length) return null;
  const title = range === 'all' ? 'All-time top traders' : 'Top traders this week';
  const lines = entries.map((e, i) => {
    const rank = MEDALS[i] ?? `${i + 1}.`;
    const top = tickerLabel(e.topTicker);
    const tail = [plural(e.exits, 'exit'), multipleTag(e.bestMultiple).trim(), top && `top ${top}`]
      .filter(Boolean)
      .join(' · ');
    return `${rank} <b>${e.walletShort}</b> — +${fullUsd(e.realizedUsd)} (${tail})`;
  });
  return `🏆 <b>ExitRadar — ${title}</b>\n\n${lines.join('\n')}\n\n📊 Full leaderboard → exitradar.fun`;
}

async function postLeaderboard(): Promise<void> {
  if (!CHANNEL || !env.enableLeaderboard) return;
  try {
    const text = await leaderboardText();
    if (!text) return void console.log('[alert-bot] leaderboard empty — skipping');
    await send(CHANNEL, text, markup([siteBtn('📊 Full leaderboard', '/leaderboard')]));
    console.log('[alert-bot] posted leaderboard');
  } catch (e) {
    console.error('[alert-bot] leaderboard failed:', e instanceof Error ? e.message : e);
  }
}

async function buildDigest(): Promise<{ text: string; wallet: string } | null> {
  const { exits = [] } = await api<{ exits?: ExitDto[] }>('/api/feed/recent?tier=pro&limit=200');
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const day = exits.filter((e) => e.ts >= since);
  if (!day.length) return null;

  const total = day.reduce((s, e) => s + e.pnlUsd, 0);
  const wallets = new Set(day.map((e) => e.wallet)).size;
  const biggest = day.reduce((m, e) => (e.pnlUsd > m.pnlUsd ? e : m), day[0]!);

  // Most-distributed token: most distinct wallets exiting the same mint.
  const byMint = new Map<string, { ticker: string; wallets: Set<string> }>();
  for (const e of day) {
    const agg = byMint.get(e.mint) ?? { ticker: e.ticker, wallets: new Set<string>() };
    agg.wallets.add(e.wallet);
    byMint.set(e.mint, agg);
  }
  const hot = [...byMint.values()].sort((a, b) => b.wallets.size - a.wallets.size)[0];

  const lines = [
    '📊 <b>ExitRadar — last 24h</b>',
    '',
    `💰 <b>+${fullUsd(total)}</b> realized across <b>${plural(day.length, 'exit')}</b> by <b>${plural(wallets, 'wallet')}</b>`,
    `🏆 Biggest: <b>${biggest.walletShort}</b> +${fullUsd(biggest.pnlUsd)} on <b>${tk(biggest.ticker)}</b>${multipleTag(biggest.multiple, ' · ')}`,
  ];
  if (hot && hot.wallets.size >= 2) {
    lines.push(`🔥 Most distributed: <b>${tk(hot.ticker)}</b> — ${plural(hot.wallets.size, 'wallet')} out`);
  }
  lines.push('', '📈 exitradar.fun/leaderboard');
  return { text: lines.join('\n'), wallet: biggest.wallet };
}

async function postDigest(): Promise<void> {
  if (!CHANNEL || !env.enableDigest) return;
  try {
    const d = await buildDigest();
    if (!d) return void console.log('[alert-bot] digest: no exits in 24h — skipping');
    await send(CHANNEL, d.text, markup([trackWalletBtn(d.wallet), siteBtn('📊 Leaderboard', '/leaderboard')]));
    console.log('[alert-bot] posted daily digest');
  } catch (e) {
    console.error('[alert-bot] digest failed:', e instanceof Error ? e.message : e);
  }
}

// On-demand DM views (reuse the same API the channel content runs on).
async function signalsText(): Promise<string | null> {
  const { signals = [] } = await api<{ signals?: SignalDto[] }>(`/api/signals?minWallets=${env.signalMinWallets}`);
  if (!signals.length) return null;
  const hrs = Math.round((signals[0]!.windowMs ?? 21_600_000) / 3_600_000);
  const lines = signals.slice(0, 8).map(
    (s) => `• <b>${tk(s.ticker)}</b> — ${plural(s.wallets, 'wallet')} out · +${fullUsd(s.realizedUsd)}`,
  );
  return `🛰️ <b>Smart money exiting now</b> (last ${hrs}h)\n\n${lines.join('\n')}\n\n📊 exitradar.fun`;
}

async function recentText(): Promise<string | null> {
  const { exits = [] } = await api<{ exits?: ExitDto[] }>('/api/feed/recent?tier=pro&limit=10');
  if (!exits.length) return null;
  const lines = exits.slice(0, 10).map(
    (e) => `• <b>${e.walletShort}</b> +${fullUsd(e.pnlUsd)} ${tk(e.ticker)}${multipleTag(e.multiple, ' · ')} <i>${ago(e.ts)}</i>`,
  );
  return `🕒 <b>Latest cash-outs</b>\n\n${lines.join('\n')}\n\n📊 Live feed → exitradar.fun`;
}

async function walletText(addr: string): Promise<string | null> {
  const p = await apiMaybe<WalletDto>(`/api/wallet/${addr}`);
  if (!p) return null;
  const head = [
    `👛 <b>${p.walletShort}</b>`,
    `💰 +${fullUsd(p.realizedUsd)} realized · ${plural(p.exits.length, 'exit')}${multipleTag(p.bestMultiple, ' · best ')}`,
    `🕒 last cash-out ${ago(p.lastSeen)}`,
  ];
  const recent = p.exits
    .slice(0, 5)
    .map((e) => `• +${fullUsd(e.pnlUsd)} ${tk(e.ticker)}${multipleTag(e.multiple, ' · ')}`);
  return `${head.join('\n')}\n\n${recent.join('\n')}\n\n📊 exitradar.fun/wallet/${addr}`;
}

async function tokenText(mint: string): Promise<string | null> {
  const p = await apiMaybe<TokenDto>(`/api/token/${mint}`);
  if (!p) return null;
  const head = [
    `🪙 <b>${tk(p.ticker)}</b>`,
    `💸 +${fullUsd(p.realizedUsd)} realized · ${plural(p.exitsCount, 'exit')} · ${plural(p.walletsCount, 'wallet')}`,
    `🏆 biggest +${fullUsd(p.topExitUsd)}${multipleTag(p.bestMultiple, ' · best ')} · last ${ago(p.lastSeen)}`,
  ];
  const recent = p.exits.slice(0, 5).map((e) => `• <b>${e.walletShort}</b> +${fullUsd(e.pnlUsd)}`);
  return `${head.join('\n')}\n\n<u>Recent sellers</u>\n${recent.join('\n')}\n\n📊 exitradar.fun/token/${mint}`;
}

async function postWeekly(): Promise<void> {
  if (!CHANNEL || !env.enableWeekly) return;
  try {
    const { entries = [] } = await api<{ entries?: LeaderboardEntryDto[] }>('/api/leaderboard?range=week&limit=100');
    if (!entries.length) return void console.log('[alert-bot] weekly: empty — skipping');
    const total = entries.reduce((s, e) => s + e.realizedUsd, 0);
    const podium = entries.slice(0, 3).map((e, i) => {
      const top = tickerLabel(e.topTicker);
      return `${MEDALS[i]} <b>${e.walletShort}</b> — +${fullUsd(e.realizedUsd)}${top ? ` (top ${top})` : ''}`;
    });
    const text =
      `🗓️ <b>ExitRadar — Weekly recap</b>\n\n` +
      `This week, top traders realized <b>+${fullUsd(total)}</b> across <b>${plural(entries.length, 'wallet')}</b>.\n\n` +
      `${podium.join('\n')}\n\n📊 Full board → exitradar.fun/leaderboard`;
    await send(CHANNEL, text, markup([siteBtn('📊 Full leaderboard', '/leaderboard')]));
    console.log('[alert-bot] posted weekly recap');
  } catch (e) {
    console.error('[alert-bot] weekly failed:', e instanceof Error ? e.message : e);
  }
}

// Smart-money signals: many distinct wallets dumping one token. Deduped so the channel only
// hears about a cluster when it FIRST forms and each time it grows stronger (more wallets).
async function pollSignals(): Promise<void> {
  if (!CHANNEL || !env.enableSignals) return;
  try {
    const { signals = [] } = await api<{ signals?: SignalDto[] }>(`/api/signals?minWallets=${env.signalMinWallets}`);
    for (const s of signals) {
      const key = `er:sig:${s.mint}`;
      const prevWallets = Number((await redis.get(key)) ?? 0);
      if (s.wallets <= prevWallets) continue; // already announced at this strength
      await redis.set(key, String(s.wallets), 'PX', Math.max(s.windowMs, 60_000));
      const tk = tickerLabel(s.ticker) || '$' + s.ticker;
      const hrs = Math.round(s.windowMs / 3_600_000);
      const text =
        `🛰️ <b>Smart money exiting ${tk}</b>\n` +
        `👛 <b>${plural(s.wallets, 'wallet')}</b> cashed out · ${plural(s.exits, 'exit')} · +${fullUsd(s.realizedUsd)} realized (${hrs}h)\n` +
        `🔗 <a href="https://exitradar.fun/token/${s.mint}">who's selling →</a>`;
      await send(CHANNEL, text, markup([siteBtn(`📊 ${tk}`, `/token/${s.mint}`), siteBtn('🛰️ More signals', '/')]));
      console.log(`[alert-bot] posted signal ${tk} (${s.wallets} wallets)`);
    }
  } catch (e) {
    console.error('[alert-bot] signals failed:', e instanceof Error ? e.message : e);
  }
}

// ── Cron-like scheduling (UTC wall-clock anchors, restart-safe via SET NX) ─────
function dayBucket(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}
function weekBucket(): string {
  // ISO-ish week key; good enough to fire a recap once per calendar week.
  const d = new Date();
  const onejan = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.floor((d.getTime() - onejan) / (7 * 24 * 3600 * 1000));
  return `${d.getUTCFullYear()}W${week}`;
}

// Run fn at most once per bucket across all restarts (atomic SET NX with a TTL).
async function once(bucket: string, fn: () => Promise<void>): Promise<void> {
  const ok = await redis.set(`er:post:${bucket}`, '1', 'EX', 8 * 24 * 3600, 'NX');
  if (ok === 'OK') await fn();
}

async function cronTick(): Promise<void> {
  const now = new Date();
  const h = now.getUTCHours();
  const day = dayBucket();
  if (h === env.leaderboardHourUtc) await once(`lb:${day}`, postLeaderboard);
  if (h === env.digestHourUtc) await once(`digest:${day}`, postDigest);
  if (now.getUTCDay() === 1 && h === env.weeklyHourUtc) await once(`weekly:${weekBucket()}`, postWeekly);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
interface TgUpdate {
  update_id: number;
  message?: { text?: string; chat?: { id?: number } };
}

async function main(): Promise<void> {
  await sub.subscribe(env.redisChannel);
  sub.on('message', (_ch, msg) => {
    try {
      void onExit(JSON.parse(msg) as ExitRow);
    } catch (e) {
      console.error('[alert-bot] bad exit message:', e instanceof Error ? e.message : e);
    }
  });
  await tg('deleteWebhook', {}).catch(() => {}); // ensure long-polling works
  await tg('setMyCommands', { commands: COMMANDS }).catch(() => {}); // populate the "/" menu
  try {
    const me = await tg<{ username?: string }>('getMe', {});
    if (me.username) botUsername = me.username;
  } catch {
    /* keep env fallback */
  }
  console.log(`[alert-bot] live — relaying "${env.redisChannel}" to followers; commands via long-poll (bot=@${botUsername}).`);

  if (CHANNEL) {
    console.log(
      `[alert-bot] channel ${CHANNEL}: big-exit ≥ $${env.channelMinUsd}` +
        `${env.enableSignals ? `, signals every ${Math.round(env.signalIntervalMs / 60000)}m` : ''}` +
        `${env.enableLeaderboard ? `, leaderboard ${env.leaderboardHourUtc}:00Z` : ''}` +
        `${env.enableDigest ? `, digest ${env.digestHourUtc}:00Z` : ''}` +
        `${env.enableWeekly ? `, weekly Mon ${env.weeklyHourUtc}:00Z` : ''} (UTC).`,
    );
    // Immediate, idempotent boot post so a restart shows life right away (and dedupes per day).
    setTimeout(() => {
      void once(`lb:${dayBucket()}`, postLeaderboard);
      void once(`digest:${dayBucket()}`, postDigest);
      void pollSignals();
    }, 8_000);
    setInterval(() => void cronTick(), env.cronTickMs);
    if (env.enableSignals) setInterval(() => void pollSignals(), env.signalIntervalMs);
  }

  let offset = 0;
  for (;;) {
    try {
      const updates = await tg<TgUpdate[]>('getUpdates', { offset, timeout: 30 });
      for (const u of updates) {
        offset = u.update_id + 1;
        const m = u.message;
        if (m?.text && typeof m.chat?.id === 'number') await handle(m.chat.id, m.text);
      }
    } catch (e) {
      console.error('[alert-bot] poll error:', e instanceof Error ? e.message : e);
      await sleep(3000);
    }
  }
}

const stop = (sig: string): void => {
  console.log(`\n[alert-bot] ${sig} -> stopping`);
  process.exit(0);
};
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
void main();
