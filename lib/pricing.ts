export type PriceQuote = {
  symbol: string;
  price: number;
  updatedAt: number;
};

const PRICE_CACHE_TTL = 30_000;
const priceCache = new Map<string, PriceQuote>();

const normalizeSymbol = (symbol: string) =>
  symbol.replace("/", "").toUpperCase();

const fetchPrice = async (symbol: string): Promise<PriceQuote> => {
  const normalized = normalizeSymbol(symbol);
  const response = await fetch(
    `https://api.binance.com/api/v3/ticker/price?symbol=${normalized}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status}`);
  }

  const data = (await response.json()) as { symbol: string; price: string };
  return {
    symbol: data.symbol,
    price: Number.parseFloat(data.price),
    updatedAt: Date.now(),
  };
};

export const getSpotPrice = async (symbol: string): Promise<PriceQuote> => {
  const cached = priceCache.get(symbol);
  if (cached && Date.now() - cached.updatedAt < PRICE_CACHE_TTL) {
    return cached;
  }

  const quote = await fetchPrice(symbol);
  priceCache.set(symbol, quote);
  return quote;
};

export const getSpotPrices = async (
  symbols: string[],
): Promise<Record<string, PriceQuote>> => {
  const unique = Array.from(new Set(symbols));
  const results = await Promise.all(
    unique.map(async (symbol) => {
      const quote = await getSpotPrice(symbol);
      return [symbol, quote] as const;
    }),
  );

  return Object.fromEntries(results);
};
