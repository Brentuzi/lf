import { ParsedTrade } from "./parseTrades";
import { PriceQuote } from "./pricing";

type Lot = {
  qty: number;
  costPerUnit: number;
};

export type PositionSummary = {
  symbol: string;
  qty: number;
  avgCost: number;
  marketPrice?: number;
  unrealizedPnL: number;
};

export type PnLSummary = {
  realizedPnL: number;
  unrealizedPnL: number;
  feeTotals: Record<string, number>;
  positions: PositionSummary[];
};

export type PnLPoint = {
  time: string;
  realizedPnL: number;
};

const parseTradeDate = (value?: string) =>
  value ? new Date(value.replace(" ", "T")).getTime() : 0;

export const calculatePnL = (
  trades: ParsedTrade[],
  prices: Record<string, PriceQuote>,
): PnLSummary => {
  const lotsBySymbol = new Map<string, Lot[]>();
  const feeTotals: Record<string, number> = {};
  let realizedPnL = 0;

  const sortedTrades = [...trades].sort(
    (a, b) => parseTradeDate(a.time) - parseTradeDate(b.time),
  );

  for (const trade of sortedTrades) {
    const lots = lotsBySymbol.get(trade.symbol) ?? [];

    const feeAsset = trade.feeAsset ?? "";
    const feeAmount = trade.feeAmount ?? 0;
    if (feeAmount > 0 && feeAsset) {
      feeTotals[feeAsset] = (feeTotals[feeAsset] ?? 0) + feeAmount;
    }

    const feeInBase = trade.feeAsset === trade.baseAsset ? feeAmount : 0;
    const feeInQuote = trade.feeAsset === trade.quoteAsset ? feeAmount : 0;

    if (trade.side === "Buy") {
      const baseAcquired = Math.max(trade.baseAmount - feeInBase, 0);
      if (baseAcquired === 0) continue;
      const totalCost = trade.price * baseAcquired + feeInQuote;
      lots.push({ qty: baseAcquired, costPerUnit: totalCost / baseAcquired });
      lotsBySymbol.set(trade.symbol, lots);
      continue;
    }

    const baseSold = Math.max(trade.baseAmount - feeInBase, 0);
    let remaining = baseSold;
    let costBasis = 0;

    while (remaining > 0 && lots.length > 0) {
      const lot = lots[0];
      const qty = Math.min(remaining, lot.qty);
      costBasis += qty * lot.costPerUnit;
      lot.qty -= qty;
      remaining -= qty;
      if (lot.qty <= 0) {
        lots.shift();
      }
    }

    const proceeds = trade.price * baseSold;
    realizedPnL += proceeds - feeInQuote - costBasis;
    lotsBySymbol.set(trade.symbol, lots);
  }

  const positions: PositionSummary[] = [];
  let unrealizedPnL = 0;

  for (const [symbol, lots] of lotsBySymbol.entries()) {
    const qty = lots.reduce((sum, lot) => sum + lot.qty, 0);
    if (qty === 0) continue;
    const totalCost = lots.reduce((sum, lot) => sum + lot.qty * lot.costPerUnit, 0);
    const avgCost = totalCost / qty;
    const marketPrice = prices[symbol]?.price;
    const unrealized =
      marketPrice !== undefined ? (marketPrice - avgCost) * qty : 0;
    unrealizedPnL += unrealized;
    positions.push({
      symbol,
      qty,
      avgCost,
      marketPrice,
      unrealizedPnL: unrealized,
    });
  }

  return {
    realizedPnL,
    unrealizedPnL,
    feeTotals,
    positions,
  };
};

export const buildPnLTimeline = (trades: ParsedTrade[]): PnLPoint[] => {
  const lotsBySymbol = new Map<string, Lot[]>();
  let realizedPnL = 0;

  const sortedTrades = [...trades].sort(
    (a, b) => parseTradeDate(a.time) - parseTradeDate(b.time),
  );

  const timeline: PnLPoint[] = [];

  for (const trade of sortedTrades) {
    const lots = lotsBySymbol.get(trade.symbol) ?? [];
    const feeAmount = trade.feeAmount ?? 0;
    const feeInBase = trade.feeAsset === trade.baseAsset ? feeAmount : 0;
    const feeInQuote = trade.feeAsset === trade.quoteAsset ? feeAmount : 0;

    if (trade.side === "Buy") {
      const baseAcquired = Math.max(trade.baseAmount - feeInBase, 0);
      if (baseAcquired > 0) {
        const totalCost = trade.price * baseAcquired + feeInQuote;
        lots.push({ qty: baseAcquired, costPerUnit: totalCost / baseAcquired });
        lotsBySymbol.set(trade.symbol, lots);
      }
    } else {
      const baseSold = Math.max(trade.baseAmount - feeInBase, 0);
      let remaining = baseSold;
      let costBasis = 0;
      while (remaining > 0 && lots.length > 0) {
        const lot = lots[0];
        const qty = Math.min(remaining, lot.qty);
        costBasis += qty * lot.costPerUnit;
        lot.qty -= qty;
        remaining -= qty;
        if (lot.qty <= 0) {
          lots.shift();
        }
      }
      const proceeds = trade.price * baseSold;
      realizedPnL += proceeds - feeInQuote - costBasis;
      lotsBySymbol.set(trade.symbol, lots);
    }

    timeline.push({
      time: trade.time ?? "—",
      realizedPnL,
    });
  }

  return timeline;
};
