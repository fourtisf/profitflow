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
  // exits and a scheduled leaderboard here when TELEGRAM_CHANNEL_ID is set.
  telegramChannelId: process.env.TELEGRAM_CHANNEL_ID, // @EXITRADAR or -100…
  channelMinUsd: Number(process.env.CHANNEL_MIN_USD ?? 5_000),
  // Leaderboard auto-post: keeps the channel active when big exits are rare.
  leaderboardIntervalMs: Number(process.env.LEADERBOARD_INTERVAL_MS ?? 86_400_000), // 24h
  leaderboardRange: (process.env.LEADERBOARD_RANGE ?? 'week') as 'week' | 'all',
  leaderboardTopN: Number(process.env.LEADERBOARD_TOP_N ?? 10),
};
