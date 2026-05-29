import { ImageResponse } from 'next/og';
import { OG_ALT, OG_SIZE, renderOg } from '../lib/og';

export const runtime = 'edge';
export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(renderOg(), { ...OG_SIZE });
}
