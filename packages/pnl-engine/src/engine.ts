// engine.ts
// Pure realized-PnL engine. No network, no side effects -> unit-testable.
//
// PORTED VERBATIM from the validated pnl-engine.js. The arithmetic is unchanged on purpose
// (see HANDOFF.md "Locked decisions"); only TypeScript types were added. Do NOT rewrite the math.
//
// Input: an ordered list of position events for ONE wallet + ONE token mint.
//   { kind: 'buy'|'sell'|'transfer_in'|'transfer_out', amount, usd, ts, sig }
//     amount = token amount (UI units, decimals already applied)
//     usd    = USD value of the value-leg (SOL+stables) for buys/sells; ignored for transfers
//
// Output: realized PnL + remaining position, plus a per-event ledger and warnings.
//
// Design decisions (the ones that actually matter for accuracy):
//   - transfer_in  : tokens enter with ZERO cost basis. This is the classic trap that
//                    fabricates infinite multiples. We DO NOT count it as profit; we flag it.
//   - transfer_out : tokens leave WITHOUT a sale. We remove them at average cost and realize
//                    NOTHING. Treating a self-transfer as a "sell" is the #1 way these tools lie.
//   - oversell     : selling more than held (bad data / missed buys) is clamped and flagged.

export type EventKind = 'buy' | 'sell' | 'transfer_in' | 'transfer_out';

export interface PositionEvent {
  kind: EventKind;
  amount: number; // token amount, UI units (decimals already applied)
  usd?: number; // USD value-leg for buys/sells; ignored for transfers
  ts?: number; // unix seconds
  sig?: string; // tx signature
}

export interface LedgerEntry extends PositionEvent {
  avgCostAfter?: number;
  costOfThisSell?: number;
  realized: number;
}

export interface AverageCostResult {
  method: 'average_cost';
  realizedPnL: number;
  totalProceeds: number;
  costOfSold: number;
  tokensRemaining: number;
  costBasisRemaining: number;
  avgEntryRemaining: number;
  multipleOnSold: number | null;
  ledger: LedgerEntry[];
  warnings: string[];
}

export interface FifoResult {
  method: 'fifo';
  realizedPnL: number;
  totalProceeds: number;
  costOfSold: number;
  tokensRemaining: number;
  costBasisRemaining: number;
  multipleOnSold: number | null;
  warnings: string[];
}

const EPS = 1e-9;

// ---------- AVERAGE COST (primary, what we display) ----------
export function computeAverageCost(events: PositionEvent[]): AverageCostResult {
  let tokensHeld = 0; // current token balance
  let costHeld = 0; // USD cost basis of current balance
  let realized = 0; // realized PnL (USD)
  let proceeds = 0; // total USD received from sells
  let costOfSold = 0; // USD cost basis attributed to sold tokens
  const ledger: LedgerEntry[] = [];
  const warnings: string[] = [];

  for (const e of events) {
    const avg = tokensHeld > EPS ? costHeld / tokensHeld : 0;

    if (e.kind === 'buy') {
      tokensHeld += e.amount;
      costHeld += e.usd as number;
      ledger.push({ ...e, avgCostAfter: tokensHeld > EPS ? costHeld / tokensHeld : 0, realized: 0 });
    } else if (e.kind === 'sell') {
      let sellAmt = e.amount;
      if (sellAmt > tokensHeld + EPS) {
        warnings.push(
          `oversell at ${e.sig?.slice(0, 8)}: sold ${sellAmt} but held ${tokensHeld.toFixed(4)} (missed buys or inflow). Clamped.`,
        );
        sellAmt = tokensHeld;
      }
      const basis = avg * sellAmt; // cost of the tokens being sold
      const r = (e.usd as number) - basis; // realized PnL for this sell
      realized += r;
      proceeds += e.usd as number;
      costOfSold += basis;
      tokensHeld -= sellAmt;
      costHeld -= basis;
      if (tokensHeld < EPS) {
        tokensHeld = 0;
        costHeld = 0;
      }
      ledger.push({ ...e, costOfThisSell: basis, realized: r });
    } else if (e.kind === 'transfer_in') {
      tokensHeld += e.amount; // ZERO cost basis added
      warnings.push(
        `transfer_in at ${e.sig?.slice(0, 8)}: ${e.amount} tokens with unknown cost basis -> treated as $0 cost. Realized PnL on these will be overstated if later sold.`,
      );
      ledger.push({ ...e, avgCostAfter: tokensHeld > EPS ? costHeld / tokensHeld : 0, realized: 0 });
    } else if (e.kind === 'transfer_out') {
      let outAmt = e.amount;
      if (outAmt > tokensHeld + EPS) {
        outAmt = tokensHeld;
      }
      const basisOut = avg * outAmt;
      tokensHeld -= outAmt;
      costHeld -= basisOut; // remove at avg cost, NO realized PnL
      if (tokensHeld < EPS) {
        tokensHeld = 0;
        costHeld = 0;
      }
      warnings.push(
        `transfer_out at ${e.sig?.slice(0, 8)}: ${outAmt} tokens left the wallet (not a sale) -> excluded from realized PnL.`,
      );
      ledger.push({ ...e, realized: 0 });
    }
  }

  return {
    method: 'average_cost',
    realizedPnL: round(realized),
    totalProceeds: round(proceeds),
    costOfSold: round(costOfSold),
    tokensRemaining: round(tokensHeld),
    costBasisRemaining: round(costHeld),
    avgEntryRemaining: tokensHeld > EPS ? round(costHeld / tokensHeld, 8) : 0,
    multipleOnSold: costOfSold > EPS ? round(proceeds / costOfSold, 2) : null,
    ledger,
    warnings,
  };
}

// ---------- FIFO (alternative, for comparison) ----------
export function computeFIFO(events: PositionEvent[]): FifoResult {
  const lots: { amount: number; unitCost: number }[] = []; // queue of {amount, unitCost}
  let realized = 0,
    proceeds = 0,
    costOfSold = 0;
  const warnings: string[] = [];

  for (const e of events) {
    if (e.kind === 'buy' || e.kind === 'transfer_in') {
      const unit = e.kind === 'buy' && e.amount > EPS ? (e.usd as number) / e.amount : 0;
      if (e.kind === 'transfer_in') warnings.push(`transfer_in ${e.sig?.slice(0, 8)}: $0 cost lot.`);
      lots.push({ amount: e.amount, unitCost: unit });
    } else if (e.kind === 'sell' || e.kind === 'transfer_out') {
      let remaining = e.amount;
      let basis = 0;
      while (remaining > EPS && lots.length) {
        const lot = lots[0]!;
        const take = Math.min(remaining, lot.amount);
        basis += take * lot.unitCost;
        lot.amount -= take;
        remaining -= take;
        if (lot.amount < EPS) lots.shift();
      }
      if (remaining > EPS) warnings.push(`oversell ${e.sig?.slice(0, 8)}: ${remaining} unmatched. Clamped.`);
      if (e.kind === 'sell') {
        realized += (e.usd as number) - basis;
        proceeds += e.usd as number;
        costOfSold += basis;
      }
    }
  }
  const tokensRemaining = lots.reduce((s, l) => s + l.amount, 0);
  const costBasisRemaining = lots.reduce((s, l) => s + l.amount * l.unitCost, 0);
  return {
    method: 'fifo',
    realizedPnL: round(realized),
    totalProceeds: round(proceeds),
    costOfSold: round(costOfSold),
    tokensRemaining: round(tokensRemaining),
    costBasisRemaining: round(costBasisRemaining),
    multipleOnSold: costOfSold > EPS ? round(proceeds / costOfSold, 2) : null,
    warnings,
  };
}

export function round(n: number, d = 2): number {
  const f = 10 ** d;
  return Math.round((n + Number.EPSILON) * f) / f;
}
