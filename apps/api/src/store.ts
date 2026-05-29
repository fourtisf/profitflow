// Lightweight stores for waitlist + wallet follows.
//
// Default: in-memory (fine for sim/demo). When DATABASE_URL is set these should be backed by
// Postgres (Prisma schema lives in apps/web/prisma — shared DB). Kept behind a tiny interface so
// swapping the implementation is a one-file change.

export interface WaitlistStore {
  add(email: string): Promise<{ created: boolean; total: number }>;
  count(): Promise<number>;
}

export interface FollowStore {
  follow(userKey: string, wallet: string): Promise<string[]>;
  unfollow(userKey: string, wallet: string): Promise<string[]>;
  list(userKey: string): Promise<string[]>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isEmail(s: string): boolean {
  return EMAIL_RE.test(s);
}

export function createInMemoryWaitlist(): WaitlistStore {
  const emails = new Set<string>();
  return {
    async add(email) {
      const normalized = email.trim().toLowerCase();
      const had = emails.has(normalized);
      emails.add(normalized);
      return { created: !had, total: emails.size };
    },
    async count() {
      return emails.size;
    },
  };
}

export function createInMemoryFollows(): FollowStore {
  const byUser = new Map<string, Set<string>>();
  const get = (k: string) => byUser.get(k) ?? byUser.set(k, new Set()).get(k)!;
  return {
    async follow(userKey, wallet) {
      get(userKey).add(wallet);
      return [...get(userKey)];
    },
    async unfollow(userKey, wallet) {
      get(userKey).delete(wallet);
      return [...get(userKey)];
    },
    async list(userKey) {
      return [...get(userKey)];
    },
  };
}
