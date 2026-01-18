import { supabase } from "./supabaseClient";
import { ParsedTrade } from "./parseTrades";

type TradeRow = {
  id?: string;
  user_id: string;
  session_id: string;
  symbol: string;
  market_type: string;
  order_type: string;
  side: string;
  quote_amount: number;
  quote_asset: string;
  price: number;
  price_asset: string;
  base_amount: number;
  base_asset: string;
  fee_amount: number | null;
  fee_asset: string | null;
  trade_time: string | null;
  order_id: string | null;
  trade_id: string | null;
};

const mapTradeToRow = (
  trade: ParsedTrade,
  userId: string,
  sessionId: string,
): TradeRow => ({
  user_id: userId,
  session_id: sessionId,
  symbol: trade.symbol,
  market_type: trade.marketType,
  order_type: trade.orderType,
  side: trade.side,
  quote_amount: trade.quoteAmount,
  quote_asset: trade.quoteAsset,
  price: trade.price,
  price_asset: trade.priceAsset,
  base_amount: trade.baseAmount,
  base_asset: trade.baseAsset,
  fee_amount: trade.feeAmount ?? null,
  fee_asset: trade.feeAsset ?? null,
  trade_time: trade.time ? trade.time.replace(" ", "T") : null,
  order_id: trade.orderId ?? null,
  trade_id: trade.tradeId ?? null,
});

const normalizeTime = (value?: string | null) =>
  value
    ? value
        .replace("T", " ")
        .replace(/(\.\d+)?(Z|[+-]\d\d:\d\d)?$/, "")
    : undefined;

const mapRowToTrade = (row: TradeRow): ParsedTrade => ({
  symbol: row.symbol,
  marketType: row.market_type,
  orderType: row.order_type,
  side: row.side as ParsedTrade["side"],
  quoteAmount: row.quote_amount,
  quoteAsset: row.quote_asset,
  price: row.price,
  priceAsset: row.price_asset,
  baseAmount: row.base_amount,
  baseAsset: row.base_asset,
  feeAmount: row.fee_amount ?? undefined,
  feeAsset: row.fee_asset ?? undefined,
  time: normalizeTime(row.trade_time),
  orderId: row.order_id ?? undefined,
  tradeId: row.trade_id ?? undefined,
  sessionId: row.session_id,
  rawLines: [],
});

export const fetchTrades = async (
  userId: string,
  sessionId: string,
): Promise<ParsedTrade[]> => {
  if (!supabase) {
    throw new Error("Supabase не настроен");
  }
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .eq("session_id", sessionId);
  if (error) throw error;
  return (data ?? []).map(mapRowToTrade);
};

export const upsertTrades = async (
  userId: string,
  sessionId: string,
  trades: ParsedTrade[],
): Promise<void> => {
  if (!supabase) {
    throw new Error("Supabase не настроен");
  }
  if (trades.length === 0) return;
  const rows = trades.map((trade) => mapTradeToRow(trade, userId, sessionId));
  const { error } = await supabase.from("trades").upsert(rows, {
    onConflict: "user_id,session_id,order_id,trade_id,trade_time",
  });
  if (error) throw error;
};

export const fetchTradesForRange = async (
  userId: string,
  startIso: string,
  endIso: string,
): Promise<ParsedTrade[]> => {
  if (!supabase) {
    throw new Error("Supabase не настроен");
  }
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .gte("trade_time", startIso)
    .lt("trade_time", endIso);
  if (error) throw error;
  return (data ?? []).map(mapRowToTrade);
};
