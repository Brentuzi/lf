"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Session as SupaSession } from "@supabase/supabase-js";
import { TradeFilters, TradeFiltersState } from "@/components/TradeFilters";
import { TradeCharts } from "@/components/TradeCharts";
import { TradeTable } from "@/components/TradeTable";
import { parseTrades, ParsedTrade } from "@/lib/parseTrades";
import { buildPnLTimeline, calculatePnL } from "@/lib/pnl";
import { fetchTrades } from "@/lib/tradesDb";
import { supabase } from "@/lib/supabaseClient";
import { fetchSessionById } from "@/lib/sessionsDb";

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sessionId = params?.id;

  const [session, setSession] = useState<SupaSession | null>(null);
  const [trades, setTrades] = useState<ParsedTrade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [filters, setFilters] = useState<TradeFiltersState>({
    symbol: "All",
    side: "All",
    marketType: "All",
    orderType: "All",
    dateFrom: "",
    dateTo: "",
    minPrice: "",
    maxPrice: "",
    minQty: "",
    maxQty: "",
  });

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!supabase || !session?.user || !sessionId) return;
      try {
        const meta = await fetchSessionById(session.user.id, sessionId);
        setSessionName(meta?.name ?? null);
        const data = await fetchTrades(session.user.id, sessionId);
        setTrades(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки сессии");
      }
    };
    void load();
  }, [session?.user?.id, sessionId]);

  const filteredTrades = useMemo(() => {
    const minPrice = filters.minPrice ? Number(filters.minPrice) : undefined;
    const maxPrice = filters.maxPrice ? Number(filters.maxPrice) : undefined;
    const minQty = filters.minQty ? Number(filters.minQty) : undefined;
    const maxQty = filters.maxQty ? Number(filters.maxQty) : undefined;
    const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : undefined;
    const toDate = filters.dateTo ? new Date(filters.dateTo) : undefined;

    return trades.filter((trade) => {
      if (filters.symbol !== "All" && trade.symbol !== filters.symbol) {
        return false;
      }
      if (filters.side !== "All" && trade.side !== filters.side) {
        return false;
      }
      if (filters.marketType !== "All" && trade.marketType !== filters.marketType) {
        return false;
      }
      if (filters.orderType !== "All" && trade.orderType !== filters.orderType) {
        return false;
      }
      if (minPrice !== undefined && trade.price < minPrice) return false;
      if (maxPrice !== undefined && trade.price > maxPrice) return false;
      if (minQty !== undefined && trade.baseAmount < minQty) return false;
      if (maxQty !== undefined && trade.baseAmount > maxQty) return false;

      if (fromDate || toDate) {
        const tradeDate = trade.time
          ? new Date(trade.time.replace(" ", "T"))
          : undefined;
        if (!tradeDate) return false;
        if (fromDate && tradeDate < fromDate) return false;
        if (toDate && tradeDate > toDate) return false;
      }
      return true;
    });
  }, [filters, trades]);

  const pnl = useMemo(() => calculatePnL(filteredTrades, {}), [filteredTrades]);
  const pnlTimeline = useMemo(
    () => buildPnLTimeline(filteredTrades),
    [filteredTrades],
  );
  const totalQuote = useMemo(
    () => filteredTrades.reduce((sum, trade) => sum + trade.quoteAmount, 0),
    [filteredTrades],
  );
  const totalBase = useMemo(
    () => filteredTrades.reduce((sum, trade) => sum + trade.baseAmount, 0),
    [filteredTrades],
  );
  const avgPrices = useMemo(() => {
    let buyQty = 0;
    let buyCost = 0;
    let sellQty = 0;
    let sellProceeds = 0;
    for (const trade of filteredTrades) {
      if (trade.side === "Buy") {
        buyQty += trade.baseAmount;
        buyCost += trade.baseAmount * trade.price;
      } else {
        sellQty += trade.baseAmount;
        sellProceeds += trade.baseAmount * trade.price;
      }
    }
    return {
      avgBuy: buyQty > 0 ? buyCost / buyQty : 0,
      avgSell: sellQty > 0 ? sellProceeds / sellQty : 0,
      buyQty,
      sellQty,
    };
  }, [filteredTrades]);

  if (!supabase) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        Supabase не настроен.
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <p>Нужен вход для просмотра сессии.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">
              Trade Intelligence
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              {sessionName ? `Сессия: ${sessionName}` : `Сессия: ${sessionId}`}
            </h1>
            {error && (
              <p className="mt-2 text-sm text-rose-300">{error}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-200"
          >
            Назад
          </button>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-xs text-slate-400">Сделок</p>
            <p className="text-xl font-semibold">{filteredTrades.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-xs text-slate-400">Объём (quote)</p>
            <p className="text-xl font-semibold">{totalQuote.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-xs text-slate-400">Объём (base)</p>
            <p className="text-xl font-semibold">{totalBase.toFixed(4)}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-xs text-slate-400">Средняя цена покупки</p>
            <p className="text-xl font-semibold">
              {avgPrices.avgBuy ? avgPrices.avgBuy.toFixed(4) : "—"}
            </p>
            <p className="text-xs text-slate-500">
              Объём: {avgPrices.buyQty.toFixed(4)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-xs text-slate-400">Средняя цена продажи</p>
            <p className="text-xl font-semibold">
              {avgPrices.avgSell ? avgPrices.avgSell.toFixed(4) : "—"}
            </p>
            <p className="text-xs text-slate-500">
              Объём: {avgPrices.sellQty.toFixed(4)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-xs text-slate-400">PNL реализованный</p>
            <p
              className={`text-xl font-semibold ${
                pnl.realizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {pnl.realizedPnL.toFixed(2)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-xs text-slate-400">PNL нереализованный</p>
            <p
              className={`text-xl font-semibold ${
                pnl.unrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {pnl.unrealizedPnL.toFixed(2)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-xs text-slate-400">Комиссии (USDT)</p>
            <p className="text-xl font-semibold">
              {(pnl.feeTotals["USDT"] ?? 0).toFixed(4)}
            </p>
          </div>
        </section>

        <TradeFilters trades={trades} filters={filters} onChange={setFilters} />

        <TradeCharts trades={filteredTrades} pnlTimeline={pnlTimeline} />

        <TradeTable trades={filteredTrades} />

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/30">
          <h2 className="text-lg font-semibold text-slate-100">PnL сессии</h2>
          <p className="mt-2 text-sm text-slate-400">
            Реализованный: {pnl.realizedPnL.toFixed(2)} · Нереализованный:{" "}
            {pnl.unrealizedPnL.toFixed(2)}
          </p>
        </section>
      </main>
    </div>
  );
}
