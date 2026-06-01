// ExitRadar alert bot (interactive). Users DM the bot to follow Solana wallets; the moment a
// followed wallet cashes out, they get a DM. Data flows: worker (Helius) -> Redis exits channel
// -> this bot -> Telegram DM. Follows live in Redis so the worker dynamically tracks them.
//
// Redis keys:
//   er:watch          SET  every followed wallet (the worker polls this ∪ WATCH_ADDRESSES)
//   er:fw:<wallet>    SET  chat IDs following that wallet
//   er:fu:<chatId>    SET  wallets that user follows
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

const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const short = (w: string): string => (w.length > 9 ? `${w.slice(0, 4)}…${w.slice(-4)}` : w);
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const redis = new Redis(env.redisUrl, { maxRetriesPerRequest: 3 });
const sub = new Redis(env.redisUrl, { maxRetriesPerRequest: 3 });
redis.on('error', (e) => console.error('[alert-bot] redis:', e.message));
sub.on('error', (e) => console.error('[alert-bot] redis(sub):', e.message));

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

function send(chatId: number | string, text: string): Promise<unknown> {
  return tg('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }).catch((e) => console.error('[alert-bot] send failed:', e instanceof Error ? e.message : e));
}

const HELP =
  '👋 <b>ExitRadar alerts</b>\n\n' +
  "Follow any Solana wallet — I'll DM you the moment it cashes out. 💸\n\n" +
  '<b>/follow</b> &lt;wallet&gt; — track a wallet\n' +
  '<b>/following</b> — your watchlist\n' +
  '<b>/unfollow</b> &lt;wallet&gt; — stop tracking\n\n' +
  'Explore the leaderboard → exitradar.fun';

async function handle(chatId: number, text: string): Promise<void> {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0]!.toLowerCase().replace(/@.*$/, ''); // strip @botname mentions
  const arg = parts[1];

  if (cmd === '/start' || cmd === '/help') return void send(chatId, HELP);

  if (cmd === '/follow') {
    if (!arg || !B58.test(arg)) return void send(chatId, '⚠️ Usage: <code>/follow &lt;wallet address&gt;</code>');
    await redis.sadd('er:watch', arg);
    await redis.sadd(`er:fw:${arg}`, String(chatId));
    await redis.sadd(`er:fu:${chatId}`, arg);
    return void send(
      chatId,
      `✅ Following <b>${short(arg)}</b>.\nI'll ping you the moment it cashes out.\n\n📊 exitradar.fun/wallet/${arg}`,
    );
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

  return void send(chatId, 'Unknown command. Try /help');
}

interface ExitRow {
  sig: string;
  ticker: string;
  wallet: string;
  wallet_short: string;
  pnl_usd: number;
  multiple: number | null;
}

async function onExit(row: ExitRow): Promise<void> {
  const mult = row.multiple != null ? ` (${row.multiple.toFixed(1)}×)` : '';
  const text =
    `🚨 <b>${row.wallet_short}</b> cashed out <b>${row.ticker}</b>\n` +
    `💸 +${fullUsd(row.pnl_usd)}${mult}\n` +
    `🔗 <a href="https://solscan.io/tx/${row.sig}">verify</a> · ` +
    `<a href="https://exitradar.fun/wallet/${row.wallet}">wallet</a>`;

  // 1) DM every follower of this wallet.
  const followers = await redis.smembers(`er:fw:${row.wallet}`);
  for (const chatId of followers) await send(chatId, text);

  // 2) Broadcast big exits to the public channel (independent of followers).
  if (env.telegramChannelId && row.pnl_usd >= env.channelMinUsd) {
    await send(env.telegramChannelId, text);
  }
}

interface LeaderboardEntryDto {
  walletShort: string;
  realizedUsd: number;
  exits: number;
  bestMultiple: number | null;
  topTicker: string;
}

const MEDALS = ['🥇', '🥈', '🥉'];

async function postLeaderboard(): Promise<void> {
  if (!env.telegramChannelId) return;
  try {
    const url = `${env.apiUrl}/api/leaderboard?range=${env.leaderboardRange}&limit=${env.leaderboardTopN}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`leaderboard HTTP ${res.status}`);
    const data = (await res.json()) as { entries?: LeaderboardEntryDto[] };
    const entries = data.entries ?? [];
    if (!entries.length) {
      console.log('[alert-bot] leaderboard empty — skipping channel post');
      return;
    }
    const title = env.leaderboardRange === 'all' ? 'All-time top traders' : 'Top traders this week';
    const lines = entries.map((e, i) => {
      const rank = MEDALS[i] ?? `${i + 1}.`;
      const mult = e.bestMultiple != null ? ` · ${e.bestMultiple.toFixed(1)}×` : '';
      return `${rank} <b>${e.walletShort}</b> — +${fullUsd(e.realizedUsd)} (${e.exits} exits${mult}, top ${e.topTicker})`;
    });
    const text =
      `🏆 <b>ExitRadar — ${title}</b>\n\n` +
      lines.join('\n') +
      `\n\n📊 Full leaderboard → <a href="https://exitradar.fun/leaderboard">exitradar.fun</a>`;
    await send(env.telegramChannelId, text);
    console.log(`[alert-bot] posted leaderboard (${entries.length} entries) to ${env.telegramChannelId}`);
  } catch (e) {
    console.error('[alert-bot] leaderboard post failed:', e instanceof Error ? e.message : e);
  }
}

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
  console.log(`[alert-bot] live — relaying "${env.redisChannel}" to followers; commands via long-poll.`);

  if (env.telegramChannelId) {
    console.log(
      `[alert-bot] channel broadcast on: exits ≥ $${env.channelMinUsd} → ${env.telegramChannelId}; ` +
        `leaderboard every ${Math.round(env.leaderboardIntervalMs / 3_600_000)}h.`,
    );
    // Kick off one leaderboard shortly after boot, then on a fixed interval.
    setTimeout(() => void postLeaderboard(), 10_000);
    setInterval(() => void postLeaderboard(), env.leaderboardIntervalMs);
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
