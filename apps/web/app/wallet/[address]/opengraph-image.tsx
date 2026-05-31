import { ImageResponse } from 'next/og';
import { OG_SIZE } from '../../../lib/og';
import { walletCard } from '../../../lib/entity-card';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'ExitRadar — wallet realized profit';

export default async function Image({ params }: { params: { address: string } }) {
  return new ImageResponse(await walletCard(params.address), { ...OG_SIZE });
}
