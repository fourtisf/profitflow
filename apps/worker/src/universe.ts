// Bounded universe: only track tokens graduated from pump.fun OR with liquidity above the floor,
// to keep RPC/credit cost sane. MVP accepts everything the watched wallets touch; the auto-refresh
// from a liquidity source is a documented TODO.
export class Universe {
  private allow = new Set<string>();

  constructor(private readonly floorUsd: number) {}

  /** When the allowlist is empty (MVP), accept all so watched-wallet ingest still flows. */
  allows(mint: string): boolean {
    return this.allow.size === 0 || this.allow.has(mint);
  }

  add(mint: string): void {
    this.allow.add(mint);
  }

  async refresh(): Promise<void> {
    // TODO(M3): populate from a liquidity source (Birdeye token list) where liquidity >= floorUsd,
    // plus pump.fun graduations, and prune. Until then we run open (accept all).
    console.log(
      `[universe] running open (accept-all). TODO: auto-populate tokens with liquidity >= $${this.floorUsd.toLocaleString()}.`,
    );
  }
}
