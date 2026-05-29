// Posting targets. Telegram is fully wired (Bot API takes a photo URL directly). X requires
// OAuth 1.0a + chunked media upload — left as a clearly-marked stub.

export async function postTelegram(
  token: string,
  chatId: string,
  photoUrl: string,
  caption: string,
): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption }),
  });
  if (!res.ok) throw new Error(`telegram ${res.status}: ${await res.text()}`);
}

export async function postX(_photoUrl: string, _caption: string): Promise<void> {
  // TODO(M5): implement with twitter-api-v2 — OAuth 1.0a user context, upload the PNG via the media
  // endpoint, then create the post referencing media_id. Needs X_API_*/X_ACCESS_* credentials.
  throw new Error('X posting not implemented yet (needs OAuth 1.0a + media upload)');
}
