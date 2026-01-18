export type TradeSide = "Buy" | "Sell";

export type ParsedTrade = {
  symbol: string;
  marketType: string;
  orderType: string;
  side: TradeSide;
  quoteAmount: number;
  quoteAsset: string;
  price: number;
  priceAsset: string;
  baseAmount: number;
  baseAsset: string;
  feeAmount?: number;
  feeAsset?: string;
  time?: string;
  orderId?: string;
  tradeId?: string;
  sessionId?: string;
  rawLines: string[];
};

export type ParseResult = {
  trades: ParsedTrade[];
  errors: string[];
};

const MAIN_LINE_REGEX =
  /^(\S+)\s+(\S+)\s+(\S+)\s+(Buy|Sell)\s+([\d,.]+)\s+(\S+)\s+([\d,.]+)\s+(\S+)\s+([\d,.]+)\s+(\S+)/;
const SHORT_MAIN_LINE_REGEX =
  /^(\S+)\s+(\S+)\s+(\S+)\s+(Buy|Sell)\s+([\d,.]+)\s+(\S+)\s*$/i;
const FEE_LINE_REGEX = /^([\d,.]+)\s+(\S+)/;
const TIME_LINE_REGEX =
  /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+)/;

const toNumber = (value: string): number =>
  Number.parseFloat(value.replace(/,/g, ""));

const QUOTE_ASSETS = ["USDT", "USDC", "BUSD", "BTC", "ETH", "BNB", "MNT", "EUR"];

const splitRow = (line: string): string[] => {
  if (line.includes("\t")) {
    return line.split("\t").map((cell) => cell.trim());
  }
  if (line.includes(",")) {
    return line.split(",").map((cell) => cell.trim());
  }
  return line.split(/\s{2,}/).map((cell) => cell.trim());
};

const normalizeHeader = (value: string) =>
  value.toLowerCase().replace(/\s+/g, " ").trim();

const symbolToPair = (value: string): { symbol: string; base: string; quote: string } => {
  if (value.includes("/")) {
    const [base, quote] = value.split("/");
    return { symbol: value, base, quote };
  }
  const upper = value.toUpperCase();
  const quote = QUOTE_ASSETS.find((asset) => upper.endsWith(asset));
  if (!quote) {
    return { symbol: upper, base: upper, quote: upper };
  }
  const base = upper.slice(0, upper.length - quote.length);
  return { symbol: `${base}/${quote}`, base, quote };
};

const parseTimestampUtc = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const [datePart, timePart] = trimmed.split(" ");
  if (!datePart || !timePart) return undefined;
  const [month, day, year] = datePart.split("/").map((part) => Number(part));
  if (!month || !day || !year) return undefined;
  const [hour, minute, second] = timePart.split(":");
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)} ${pad(Number(hour))}:${pad(
    Number(minute),
  )}:${pad(Number(second ?? 0))}`;
};

const parseTableFormat = (lines: string[]): ParseResult => {
  const headerLine = lines[0];
  const headers = splitRow(headerLine).map(normalizeHeader);
  const indexOf = (name: string) => headers.indexOf(normalizeHeader(name));

  const idxSymbol = indexOf("spot pairs");
  const idxOrderType = indexOf("order type");
  const idxSide = indexOf("direction");
  const idxFeeCoin = indexOf("feecoin");
  const idxFeeAlt = indexOf("execfeev2");
  const idxFilledValue = indexOf("filled value");
  const idxFilledPrice = indexOf("filled price");
  const idxFilledQty = indexOf("filled quantity");
  const idxFees = indexOf("fees");
  const idxTxn = indexOf("transaction id");
  const idxOrderNo = indexOf("order no.");
  const idxTimestamp = indexOf("timestamp (utc)");

  const trades: ParsedTrade[] = [];
  const errors: string[] = [];

  for (const line of lines.slice(1)) {
    const cols = splitRow(line);
    if (cols.length < headers.length) {
      errors.push(`Недостаточно колонок в строке: "${line}"`);
      continue;
    }
    const symbolValue = cols[idxSymbol] ?? "";
    const { symbol, base, quote } = symbolToPair(symbolValue);
    const sideRaw = (cols[idxSide] ?? "").toUpperCase();
    const side = sideRaw === "BUY" ? "Buy" : sideRaw === "SELL" ? "Sell" : undefined;
    if (!side) {
      errors.push(`Не удалось распознать сторону сделки: "${line}"`);
      continue;
    }

    const feeCoin = cols[idxFeeCoin] ?? "";
    const feeRaw = cols[idxFees] ?? cols[idxFeeAlt] ?? "0";
    const feeAmount = feeRaw ? Number.parseFloat(feeRaw) : 0;
    const filledValue = cols[idxFilledValue] ?? "0";
    const filledPrice = cols[idxFilledPrice] ?? "0";
    const filledQty = cols[idxFilledQty] ?? "0";
    const timestamp = cols[idxTimestamp] ?? "";

    const trade: ParsedTrade = {
      symbol,
      marketType: "Spot",
      orderType: cols[idxOrderType] ?? "",
      side,
      quoteAmount: toNumber(filledValue),
      quoteAsset: quote,
      price: toNumber(filledPrice),
      priceAsset: quote,
      baseAmount: toNumber(filledQty),
      baseAsset: base,
      feeAmount: feeAmount || undefined,
      feeAsset: feeCoin || undefined,
      time: parseTimestampUtc(timestamp),
      orderId: cols[idxOrderNo] ?? undefined,
      tradeId: cols[idxTxn] ?? undefined,
      rawLines: [line],
    };

    trades.push(trade);
  }

  return { trades, errors };
};

const TABLE_TIMESTAMP_REGEX = /^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}$/;

const parseHeaderlessTable = (lines: string[]): ParseResult => {
  const trades: ParsedTrade[] = [];
  const errors: string[] = [];

  for (const line of lines) {
    const cols = splitRow(line);
    if (cols.length < 12) {
      continue;
    }
    // A) symbol feeCoin fee feesJson orderType side value price avgPrice qty filledValue status orderNo
    // B) symbol orderType side feeCoin feeAmount filledValue filledPrice filledQty fees txnId orderNo timestamp
    const hasTimestamp = TABLE_TIMESTAMP_REGEX.test(cols[cols.length - 1]);
    const isVariantB = hasTimestamp && cols.length >= 12;

    const symbolValue = cols[0];
    const { symbol, base, quote } = symbolToPair(symbolValue);
    const sideRaw = isVariantB ? cols[2]?.toUpperCase() : cols[5]?.toUpperCase();
    const side = sideRaw === "BUY" ? "Buy" : sideRaw === "SELL" ? "Sell" : undefined;
    if (!side) {
      errors.push(`Не удалось распознать сторону сделки: "${line}"`);
      continue;
    }

    if (isVariantB) {
      const orderType = cols[1];
      const feeCoin = cols[3];
      const feeAmount = cols[4];
      const filledValue = cols[5];
      const filledPrice = cols[6];
      const filledQty = cols[7];
      const fees = cols[8];
      const txnId = cols[9];
      const orderNo = cols[10];
      const timestamp = cols[11];

      trades.push({
        symbol,
        marketType: "Spot",
        orderType: orderType ?? "",
        side,
        quoteAmount: toNumber(filledValue),
        quoteAsset: quote,
        price: toNumber(filledPrice),
        priceAsset: quote,
        baseAmount: toNumber(filledQty),
        baseAsset: base,
        feeAmount: fees ? toNumber(fees) : feeAmount ? toNumber(feeAmount) : undefined,
        feeAsset: feeCoin || undefined,
        time: parseTimestampUtc(timestamp),
        orderId: orderNo ?? undefined,
        tradeId: txnId ?? undefined,
        rawLines: [line],
      });
      continue;
    }

    const feeCoin = cols[1];
    const feeAmount = cols[2];
    const orderType = cols[4];
    const filledValue = cols[6];
    const filledPrice = cols[7];
    const filledQty = cols[9];
    const status = cols[11]?.toUpperCase();
    const orderNo = cols[12] ?? cols[11];

    if (status && status !== "FILLED") {
      continue;
    }

    trades.push({
      symbol,
      marketType: "Spot",
      orderType: orderType ?? "",
      side,
      quoteAmount: toNumber(filledValue),
      quoteAsset: quote,
      price: toNumber(filledPrice),
      priceAsset: quote,
      baseAmount: toNumber(filledQty),
      baseAsset: base,
      feeAmount: feeAmount ? toNumber(feeAmount) : undefined,
      feeAsset: feeCoin || undefined,
      orderId: orderNo,
      rawLines: [line],
    });
  }

  return { trades, errors };
};

const parseBlockFormat = (lines: string[]): ParseResult => {
  const trades: ParsedTrade[] = [];
  const errors: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.includes("Spot") || !/(Buy|Sell)/.test(line)) {
      i += 1;
      continue;
    }
    const mainMatch = line.match(MAIN_LINE_REGEX);
    const shortMatch = line.match(SHORT_MAIN_LINE_REGEX);
    let trade: ParsedTrade | null = null;

    if (mainMatch) {
      const [
        ,
        symbol,
        marketType,
        orderType,
        side,
        quoteAmountRaw,
        quoteAsset,
        priceRaw,
        priceAsset,
        baseAmountRaw,
        baseAsset,
      ] = mainMatch;

      trade = {
        symbol,
        marketType,
        orderType,
        side: side as TradeSide,
        quoteAmount: toNumber(quoteAmountRaw),
        quoteAsset,
        price: toNumber(priceRaw),
        priceAsset,
        baseAmount: toNumber(baseAmountRaw),
        baseAsset,
        rawLines: [line],
      };
    } else if (shortMatch) {
      const [
        ,
        symbol,
        marketType,
        orderType,
        side,
        quoteAmountRaw,
        quoteAsset,
      ] = shortMatch;
      trade = {
        symbol,
        marketType,
        orderType,
        side: (side.charAt(0).toUpperCase() + side.slice(1).toLowerCase()) as TradeSide,
        quoteAmount: toNumber(quoteAmountRaw),
        quoteAsset,
        price: 0,
        priceAsset: quoteAsset,
        baseAmount: 0,
        baseAsset: symbol.includes("/") ? symbol.split("/")[0] : symbol,
        rawLines: [line],
      };
    } else {
      errors.push(`Не удалось распознать строку сделки: "${line}"`);
      i += 1;
      continue;
    }

    let nextIndex = i + 1;
    const maybePriceLine = lines[nextIndex];
    if (maybePriceLine && maybePriceLine.includes("/")) {
      const [pricePart, priceAsset] = maybePriceLine.split(/\s+/);
      const [filledPrice] = pricePart.split("/");
      if (filledPrice) {
        trade.price = toNumber(filledPrice);
        if (priceAsset) {
          trade.priceAsset = priceAsset;
        }
      }
      trade.rawLines.push(maybePriceLine);
      nextIndex += 1;
    }

    const maybeQtyLine = lines[nextIndex];
    if (maybeQtyLine && maybeQtyLine.includes("/")) {
      const [qtyPart, baseAsset] = maybeQtyLine.split(/\s+/);
      const [filledQty] = qtyPart.split("/");
      if (filledQty) {
        trade.baseAmount = toNumber(filledQty);
        if (baseAsset) {
          trade.baseAsset = baseAsset;
        }
      }
      trade.rawLines.push(maybeQtyLine);
      nextIndex += 1;
    }

    while (nextIndex < lines.length && lines[nextIndex] === "--") {
      trade.rawLines.push(lines[nextIndex]);
      nextIndex += 1;
    }

    const maybeQuoteLine = lines[nextIndex];
    if (maybeQuoteLine && maybeQuoteLine.toUpperCase().includes(trade.quoteAsset)) {
      const amount = maybeQuoteLine.split(/\s+/)[0] ?? "";
      trade.quoteAmount = toNumber(amount);
      trade.rawLines.push(maybeQuoteLine);
      nextIndex += 1;
    }

    const statusLine = lines[nextIndex];
    if (statusLine) {
      trade.rawLines.push(statusLine);
      if (statusLine.toUpperCase() !== "FILLED") {
        i = nextIndex + 1;
        continue;
      }
      nextIndex += 1;
    }

    const timeLine = lines[nextIndex];
    const timeMatch = timeLine?.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)/);
    if (timeMatch) {
      trade.time = timeMatch[1];
      trade.orderId = timeMatch[2];
      trade.rawLines.push(timeLine);
      nextIndex += 1;
    }

    trades.push(trade);
    i = nextIndex;
  }

  return { trades, errors };
};

const VERTICAL_TIME_REGEX = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/;

const parseVerticalFormat = (lines: string[]): ParseResult => {
  const trades: ParsedTrade[] = [];
  const errors: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const symbolLine = lines[i];
    if (!symbolLine || !symbolLine.includes("/")) {
      i += 1;
      continue;
    }

    const marketType = lines[i + 1];
    const orderType = lines[i + 2];
    const sideRaw = lines[i + 3];
    const quoteLine = lines[i + 4];
    const priceLine = lines[i + 5];
    const qtyLine = lines[i + 6];
    const feeLabel = lines[i + 7];
    const feeLine = lines[i + 8];

    if (!marketType || !orderType || !sideRaw || !quoteLine) {
      i += 1;
      continue;
    }

    const side =
      sideRaw.toLowerCase() === "buy"
        ? "Buy"
        : sideRaw.toLowerCase() === "sell"
          ? "Sell"
          : undefined;
    if (!side) {
      errors.push(`Не удалось распознать сторону сделки: "${sideRaw}"`);
      i += 1;
      continue;
    }

    const quoteParts = quoteLine.split(/\s+/);
    const quoteAmountRaw = quoteParts[0];
    const quoteAsset = quoteParts[1] ?? "USDT";

    const baseParts = qtyLine?.split(/\s+/) ?? [];
    const baseAmountRaw = baseParts[0];
    const baseAsset = baseParts[1] ?? symbolLine.split("/")[0];

    const trade: ParsedTrade = {
      symbol: symbolLine,
      marketType,
      orderType,
      side,
      quoteAmount: toNumber(quoteAmountRaw),
      quoteAsset,
      price: priceLine ? toNumber(priceLine) : 0,
      priceAsset: quoteAsset,
      baseAmount: baseAmountRaw ? toNumber(baseAmountRaw) : 0,
      baseAsset,
      rawLines: [symbolLine, marketType, orderType, sideRaw, quoteLine],
    };

    if (feeLabel?.toLowerCase() === "trade" && feeLine) {
      const feeParts = feeLine.split(/\s+/);
      trade.feeAmount = feeParts[0] ? toNumber(feeParts[0]) : undefined;
      trade.feeAsset = feeParts[1] ?? undefined;
      trade.rawLines.push(feeLabel, feeLine);
    }

    let cursor = i + 9;
    while (cursor < lines.length && lines[cursor] === "--") {
      cursor += 1;
    }
    const maybeTime = lines[cursor];
    if (maybeTime && VERTICAL_TIME_REGEX.test(maybeTime)) {
      trade.time = maybeTime;
      trade.rawLines.push(maybeTime);
      cursor += 1;
    }
    const maybeOrderId = lines[cursor];
    if (maybeOrderId && maybeOrderId !== "--") {
      trade.orderId = maybeOrderId;
      trade.rawLines.push(maybeOrderId);
      cursor += 1;
    }
    while (cursor < lines.length && lines[cursor] === "--") {
      cursor += 1;
    }

    trades.push(trade);
    i = cursor;
  }

  return { trades, errors };
};

export const parseTrades = (input: string): ParseResult => {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const headerIndex = lines.findIndex((line) => {
    const normalized = normalizeHeader(line);
    return normalized.includes("spot pairs") && normalized.includes("order type");
  });
  if (headerIndex >= 0) {
    return parseTableFormat(lines.slice(headerIndex));
  }

  const isHeaderlessRow = (line: string) => {
    const cols = splitRow(line);
    if (cols.length < 12) return false;
    return TABLE_TIMESTAMP_REGEX.test(cols[cols.length - 1]);
  };
  if (lines.some((line) => line.includes('{"') || isHeaderlessRow(line))) {
    const result = parseHeaderlessTable(lines);
    if (result.trades.length > 0) return result;
  }

  if (lines.some((line) => line.includes("--") || line.includes("Filled"))) {
    const result = parseBlockFormat(lines);
    if (result.trades.length > 0) return result;
  }

  const verticalResult = parseVerticalFormat(lines);
  if (verticalResult.trades.length > 0) return verticalResult;

  const trades: ParsedTrade[] = [];
  const errors: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const mainMatch = line.match(MAIN_LINE_REGEX);
    if (!mainMatch) {
      errors.push(`Не удалось распознать строку сделки: "${line}"`);
      i += 1;
      continue;
    }

    const [
      ,
      symbol,
      marketType,
      orderType,
      side,
      quoteAmountRaw,
      quoteAsset,
      priceRaw,
      priceAsset,
      baseAmountRaw,
      baseAsset,
    ] = mainMatch;

    const trade: ParsedTrade = {
      symbol,
      marketType,
      orderType,
      side: side as TradeSide,
      quoteAmount: toNumber(quoteAmountRaw),
      quoteAsset,
      price: toNumber(priceRaw),
      priceAsset,
      baseAmount: toNumber(baseAmountRaw),
      baseAsset,
      rawLines: [line],
    };

    let nextIndex = i + 1;

    const feeLine = lines[nextIndex];
    const feeMatch = feeLine?.match(FEE_LINE_REGEX);
    if (feeMatch) {
      trade.feeAmount = toNumber(feeMatch[1]);
      trade.feeAsset = feeMatch[2];
      trade.rawLines.push(feeLine);
      nextIndex += 1;
    }

    const timeLine = lines[nextIndex];
    const timeMatch = timeLine?.match(TIME_LINE_REGEX);
    if (timeMatch) {
      trade.time = timeMatch[1];
      trade.orderId = timeMatch[2];
      trade.tradeId = timeMatch[3];
      trade.rawLines.push(timeLine);
      nextIndex += 1;
    }

    trades.push(trade);
    i = nextIndex;
  }

  return { trades, errors };
};
