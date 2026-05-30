import { ImageResponse } from 'next/og';
import { renderShareCard, SHARE_SIZE } from '../../../lib/card';

export const runtime = 'edge';

// GET /api/card?t=$GIGA&p=628200&m=49.3&i=13000&o=641200&w=Kd4m…8sQe  -> 1080x1080 PNG
export function GET(req: Request): ImageResponse {
  const q = new URL(req.url).searchParams;
  const num = (key: string, def = 0): number => {
    const n = Number(q.get(key));
    return Number.isFinite(n) ? n : def;
  };
  const mRaw = q.get('m');
  const multiple = mRaw && Number.isFinite(Number(mRaw)) ? Number(mRaw) : null;

  return new ImageResponse(
    renderShareCard({
      ticker: q.get('t') ?? '$TOKEN',
      pnl: num('p'),
      multiple,
      inUsd: num('i'),
      outUsd: num('o'),
      wallet: q.get('w') ?? '',
    }),
    { ...SHARE_SIZE },
  );
}
