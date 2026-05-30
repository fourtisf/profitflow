import { fullUsd } from '@profitflow/shared';
import { env } from './env';
import { postTelegram, postX } from './post';
import { caption, cardUrl, topExitSince } from './sources';

async function runOnce(): Promise<void> {
  const since = Date.now() - env.intervalMs;
  let exit;
  try {
    exit = await topExitSince(env.apiUrl, since);
  } catch (e) {
    console.error('[bot] could not fetch exits:', e instanceof Error ? e.message : String(e));
    return;
  }

  if (!exit || exit.pnlUsd < env.minPnlUsd) {
    console.log(`[bot] no exit ≥ ${fullUsd(env.minPnlUsd)} in the last window — skipping.`);
    return;
  }

  const url = cardUrl(env.siteUrl, exit);
  const text = caption(env.siteUrl, exit);
  console.log(`[bot] top exit: ${exit.ticker} +${fullUsd(exit.pnlUsd)} (${exit.walletShort})`);
  console.log(`[bot] card: ${url}`);

  if (env.telegramToken && env.telegramChatId) {
    try {
      await postTelegram(env.telegramToken, env.telegramChatId, url, text);
      console.log('[bot] posted to Telegram ✓');
    } catch (e) {
      console.error('[bot] Telegram failed:', e instanceof Error ? e.message : String(e));
    }
  } else {
    console.log('[bot] (dry-run) TELEGRAM_BOT_TOKEN/CHAT_ID unset — would post the card above.');
  }

  if (env.xConfigured) {
    try {
      await postX(url, text);
      console.log('[bot] posted to X ✓');
    } catch (e) {
      console.warn('[bot] X:', e instanceof Error ? e.message : String(e));
    }
  } else {
    console.log('[bot] (dry-run) X_* unset — would post the card above.');
  }
}

function main(): void {
  console.log(`[bot] starting — posting every ${Math.round(env.intervalMs / 60000)}m, reading ${env.apiUrl}`);
  void runOnce();
  const timer = setInterval(() => void runOnce(), env.intervalMs);
  const stop = (sig: string): void => {
    console.log(`\n[bot] ${sig} -> stopping`);
    clearInterval(timer);
    process.exit(0);
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
}

main();
