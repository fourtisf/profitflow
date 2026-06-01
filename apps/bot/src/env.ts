export const env = {
  apiUrl: process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  siteUrl: process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://profitflow.io',
  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  xConfigured: Boolean(
    process.env.X_API_KEY &&
      process.env.X_API_SECRET &&
      process.env.X_ACCESS_TOKEN &&
      process.env.X_ACCESS_SECRET,
  ),
  intervalMs: Number(process.env.BOT_INTERVAL_MS ?? 3_600_000),
  minPnlUsd: Number(process.env.BOT_MIN_PNL_USD ?? 10_000),
  // Alert bot (interactive: follow a wallet → DM when it cashes out):
  redisUrl: process.env.REDIS_URL,
  redisChannel: process.env.REDIS_EXITS_CHANNEL ?? 'profitflow:exits',
  // Public channel broadcast (e.g. @EXITRADAR). The interactive bot also posts big
  // exits, smart-money signals, a daily digest, a leaderboard and a weekly recap
  // here when TELEGRAM_CHANNEL_ID is set.
  telegramChannelId: process.env.TELEGRAM_CHANNEL_ID, // @EXITRADAR or -100…
  channelMinUsd: Number(process.env.CHANNEL_MIN_USD ?? 5_000),
  // Used to build t.me deep-links ("track this wallet"). Auto-detected via getMe at boot;
  // this is only the fallback.
  botUsername: process.env.BOT_USERNAME ?? 'exitradarflowbot',
  // Channel auto-content. Each block can be turned off with ENABLE_*=false.
  enableLeaderboard: process.env.ENABLE_LEADERBOARD !== 'false',
  enableDigest: process.env.ENABLE_DIGEST !== 'false',
  enableWeekly: process.env.ENABLE_WEEKLY !== 'false',
  enableSignals: process.env.ENABLE_SIGNALS !== 'false',
  // Leaderboard auto-post tuning.
  leaderboardRange: (process.env.LEADERBOARD_RANGE ?? 'week') as 'week' | 'all',
  leaderboardTopN: Number(process.env.LEADERBOARD_TOP_N ?? 10),
  // Wall-clock anchors (UTC hour, 0-23). VPS is UTC; Indonesia = UTC+7.
  leaderboardHourUtc: Number(process.env.LEADERBOARD_HOUR_UTC ?? 9), // ~16:00 WIB
  digestHourUtc: Number(process.env.DIGEST_HOUR_UTC ?? 13), // ~20:00 WIB
  weeklyHourUtc: Number(process.env.WEEKLY_HOUR_UTC ?? 10), // Mon ~17:00 WIB
  // Smart-money cluster signals: poll cadence + sensitivity.
  signalIntervalMs: Number(process.env.SIGNAL_INTERVAL_MS ?? 600_000), // 10m
  signalMinWallets: Number(process.env.SIGNAL_MIN_WALLETS ?? 3),
  // How often the cron tick wakes to check the wall-clock anchors above.
  cronTickMs: Number(process.env.CRON_TICK_MS ?? 900_000), // 15m
  // Above this, a "multiple" is almost certainly an unverified-basis artifact — hide it.
  maxSaneMultiple: Number(process.env.MAX_SANE_MULTIPLE ?? 1_000),
};
