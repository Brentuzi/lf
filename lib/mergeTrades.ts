import { ParsedTrade } from "./parseTrades";

const normalize = (value?: string) => (value ?? "").trim();
const normalizeTime = (value?: string) =>
  value
    ? value
        .replace("T", " ")
        .replace(/(\.\d+)?(Z|[+-]\d\d:\d\d)?$/, "")
    : "";

export const tradeKey = (trade: ParsedTrade): string => {
  const timeKey = normalizeTime(trade.time);
  if (trade.orderId && trade.tradeId && timeKey) {
    return `${trade.orderId}|${trade.tradeId}|${timeKey}`;
  }
  return [
    normalize(trade.symbol),
    normalize(trade.side),
    timeKey,
    trade.price.toFixed(8),
    trade.baseAmount.toFixed(8),
    trade.quoteAmount.toFixed(8),
  ].join("|");
};

export const mergeTrades = (
  current: ParsedTrade[],
  incoming: ParsedTrade[],
): ParsedTrade[] => {
  const map = new Map<string, ParsedTrade>();
  for (const trade of current) {
    map.set(tradeKey(trade), trade);
  }
  for (const trade of incoming) {
    const key = tradeKey(trade);
    if (!map.has(key)) {
      map.set(key, trade);
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const left = a.time ? new Date(normalizeTime(a.time).replace(" ", "T")).getTime() : 0;
    const right = b.time ? new Date(normalizeTime(b.time).replace(" ", "T")).getTime() : 0;
    return right - left;
  });
};

export const diffTrades = (
  current: ParsedTrade[],
  incoming: ParsedTrade[],
): ParsedTrade[] => {
  const existingKeys = new Set(current.map(tradeKey));
  return incoming.filter((trade) => !existingKeys.has(tradeKey(trade)));
};
