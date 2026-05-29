import { NextResponse } from 'next/server';

// Same-origin waitlist capture so the marketing page works on Vercel with no backend.
// Default: validate + log. When DATABASE_URL is set, persist via Prisma (see prisma/schema.prisma).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request): Promise<NextResponse> {
  let email = '';
  try {
    const body = (await req.json()) as { email?: unknown };
    email = String(body?.email ?? '').trim();
  } catch {
    /* fall through to validation */
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'a valid email is required' }, { status: 400 });
  }

  // TODO(M2/persistence): upsert into Postgres when DATABASE_URL is configured.
  console.log('[waitlist] signup:', email.toLowerCase());

  return NextResponse.json({ ok: true, created: true }, { status: 201 });
}
