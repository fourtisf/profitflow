import { ImageResponse } from 'next/og';
import { OG_SIZE } from '../../../lib/og';
import { tokenCard } from '../../../lib/entity-card';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'ExitRadar — token cash-outs';

export default async function Image({ params }: { params: { mint: string } }) {
  return new ImageResponse(await tokenCard(params.mint), { ...OG_SIZE });
}
