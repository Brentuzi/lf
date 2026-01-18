"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { AuthPanel } from "@/components/AuthPanel";
import { TradeUploader } from "@/components/TradeUploader";
import { TradeFilters, TradeFiltersState } from "@/components/TradeFilters";
import { TradeCharts } from "@/components/TradeCharts";
import { TradeTable } from "@/components/TradeTable";
import { parseTrades, ParsedTrade } from "@/lib/parseTrades";
import { getSpotPrices, PriceQuote } from "@/lib/pricing";
import { buildPnLTimeline, calculatePnL } from "@/lib/pnl";
import { diffTrades, mergeTrades } from "@/lib/mergeTrades";
import { fetchTrades, fetchTradesForRange, upsertTrades } from "@/lib/tradesDb";
import { supabase } from "@/lib/supabaseClient";
import { createSession, fetchSessions, TradeSession } from "@/lib/sessionsDb";

export default function Home() {
  const [rawInput, setRawInput] = useState("");
  const [trades, setTrades] = useState<ParsedTrade[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [inputErrors, setInputErrors] = useState<string[]>([]);
  const [prices, setPrices] = useState<Record<string, PriceQuote>>({});
  const [priceError, setPriceError] = useState<string | null>(null);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSupabaseReady = Boolean(supabase);
  const [sessions, setSessions] = useState<TradeSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [sessionName, setSessionName] = useState("");
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionPnL, setSessionPnL] = useState<Record<string, number>>({});
  const [autoSplitByDate, setAutoSplitByDate] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
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

  const handleParse = async () => {
    const result = parseTrades(rawInput);
    setParseErrors(result.errors);
    const merged = mergeTrades(trades, result.trades);
    setTrades(merged);

    if (!isSupabaseReady || !session?.user) return;

    setIsSyncing(true);
    try {
      if (autoSplitByDate) {
        const grouped = new Map<string, ParsedTrade[]>();
        const fallback: ParsedTrade[] = [];
        for (const trade of result.trades) {
          if (!trade.time) {
            fallback.push(trade);
            continue;
          }
          const dateKey = trade.time.split(" ")[0];
          const list = grouped.get(dateKey) ?? [];
          list.push(trade);
          grouped.set(dateKey, list);
        }

        const existingSessions = await fetchSessions(session.user.id);
        const nameToId = new Map(existingSessions.map((s) => [s.name, s.id]));
        const updatedSessions = [...existingSessions];

        for (const [dateKey, tradesForDate] of grouped.entries()) {
          let sessionId = nameToId.get(dateKey);
          if (!sessionId) {
            const created = await createSession(session.user.id, dateKey);
            sessionId = created.id;
            nameToId.set(dateKey, sessionId);
            updatedSessions.unshift(created);
          }
          await upsertTrades(session.user.id, sessionId, tradesForDate);
        }

        setSessions(updatedSessions);
        const nextSelected =
          selectedSessionId || updatedSessions[0]?.id || "";
        setSelectedSessionId(nextSelected);
        if (nextSelected) {
          const fromDb = await fetchTrades(session.user.id, nextSelected);
          setTrades(mergeTrades([], fromDb));
        }

        if (fallback.length > 0 && selectedSessionId) {
          await upsertTrades(session.user.id, selectedSessionId, fallback);
        }
      } else {
        if (!selectedSessionId) {
          setSyncError("Выберите сессию для сохранения");
          return;
        }
        const newTrades = diffTrades(trades, result.trades);
        if (newTrades.length === 0) return;
        await upsertTrades(session.user.id, selectedSessionId, newTrades);
        const fromDb = await fetchTrades(session.user.id, selectedSessionId);
        setTrades(mergeTrades([], fromDb));
      }
      setSyncError(null);
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "Ошибка сохранения в базу",
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearData = async () => {
    const confirmed = window.confirm(
      "Удалить все данные? История сделок будет очищена.",
    );
    if (!confirmed) return;
    setTrades([]);
    setRawInput("");
    setParseErrors([]);
    setInputErrors([]);
  };

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

  const totalQuote = useMemo(
    () =>
      filteredTrades.reduce((sum, trade) => sum + trade.quoteAmount, 0),
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
    const perSymbol = new Map<
      string,
      { buyQty: number; buyCost: number; sellQty: number; sellProceeds: number }
    >();
    for (const trade of filteredTrades) {
      const stats =
        perSymbol.get(trade.symbol) ?? {
          buyQty: 0,
          buyCost: 0,
          sellQty: 0,
          sellProceeds: 0,
        };
      if (trade.side === "Buy") {
        buyQty += trade.baseAmount;
        buyCost += trade.baseAmount * trade.price;
        stats.buyQty += trade.baseAmount;
        stats.buyCost += trade.baseAmount * trade.price;
      } else {
        sellQty += trade.baseAmount;
        sellProceeds += trade.baseAmount * trade.price;
        stats.sellQty += trade.baseAmount;
        stats.sellProceeds += trade.baseAmount * trade.price;
      }
      perSymbol.set(trade.symbol, stats);
    }
    return {
      avgBuy: buyQty > 0 ? buyCost / buyQty : 0,
      avgSell: sellQty > 0 ? sellProceeds / sellQty : 0,
      buyQty,
      sellQty,
      perSymbol: Array.from(perSymbol.entries()).map(([symbol, stats]) => ({
        symbol,
        avgBuy: stats.buyQty > 0 ? stats.buyCost / stats.buyQty : 0,
        avgSell: stats.sellQty > 0 ? stats.sellProceeds / stats.sellQty : 0,
        buyQty: stats.buyQty,
        sellQty: stats.sellQty,
      })),
    };
  }, [filteredTrades]);
  const pnl = useMemo(
    () => calculatePnL(filteredTrades, prices),
    [filteredTrades, prices],
  );
  const pnlTimeline = useMemo(
    () => buildPnLTimeline(filteredTrades),
    [filteredTrades],
  );

  const errors = useMemo(
    () => [...inputErrors, ...parseErrors],
    [inputErrors, parseErrors],
  );

  const handleInputError = (message: string) => {
    setInputErrors([message]);
  };

  const handleInputChange = (value: string) => {
    setRawInput(value);
    setInputErrors([]);
  };

  const handleCreateSession = async () => {
    if (!isSupabaseReady || !session?.user) {
      setSessionError("Войдите в аккаунт, чтобы создать сессию");
      return;
    }
    const name = sessionName.trim();
    if (!name) {
      setSessionError("Введите название сессии");
      return;
    }
    setSessionError(null);
    setIsSyncing(true);
    try {
      const created = await createSession(session.user.id, name);
      const nextSessions = [created, ...sessions];
      setSessions(nextSessions);
      setSelectedSessionId(created.id);
      setSessionName("");
      setTrades([]);
    } catch (error) {
      setSessionError(
        error instanceof Error ? error.message : "Ошибка создания сессии",
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const symbols = useMemo(
    () => Array.from(new Set(trades.map((trade) => trade.symbol))),
    [trades],
  );
  const symbolKey = useMemo(() => symbols.slice().sort().join("|"), [symbols]);

  const loadPrices = async () => {
    if (symbols.length === 0) return;
    setIsLoadingPrices(true);
    try {
      const quotes = await getSpotPrices(symbols);
      setPrices(quotes);
      setPriceError(null);
    } catch (error) {
      setPriceError(
        error instanceof Error ? error.message : "Не удалось получить цены",
      );
    } finally {
      setIsLoadingPrices(false);
    }
  };

  useEffect(() => {
    void loadPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolKey]);

  useEffect(() => {
    if (!isSupabaseReady) return;
    let isMounted = true;
    supabase!.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
    });

    const { data: authListener } = supabase!.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
      },
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseReady) return;
    const loadSessionsAndTrades = async () => {
      if (!session?.user) return;
      setIsSyncing(true);
      try {
        const sessionsList = await fetchSessions(session.user.id);
        let activeSessionId = selectedSessionId;
        if (sessionsList.length === 0) {
          const created = await createSession(session.user.id, "Основная");
          sessionsList.unshift(created);
          activeSessionId = created.id;
        }
        setSessions(sessionsList);
        if (!activeSessionId && sessionsList[0]) {
          activeSessionId = sessionsList[0].id;
        }
        if (activeSessionId) {
          setSelectedSessionId(activeSessionId);
          const fromDb = await fetchTrades(session.user.id, activeSessionId);
          setTrades(mergeTrades([], fromDb));
        }
        setSyncError(null);
      } catch (error) {
        setSyncError(
          error instanceof Error ? error.message : "Ошибка загрузки из базы",
        );
      } finally {
        setIsSyncing(false);
      }
    };
    void loadSessionsAndTrades();
  }, [session?.user?.id]);

  useEffect(() => {
    const loadBySession = async () => {
      if (!isSupabaseReady || !session?.user || !selectedSessionId) return;
      setIsSyncing(true);
      try {
        const fromDb = await fetchTrades(session.user.id, selectedSessionId);
        setTrades(mergeTrades([], fromDb));
      } catch (error) {
        setSyncError(
          error instanceof Error ? error.message : "Ошибка загрузки сессии",
        );
      } finally {
        setIsSyncing(false);
      }
    };
    void loadBySession();
  }, [isSupabaseReady, session?.user?.id, selectedSessionId]);

  useEffect(() => {
    const loadPnL = async () => {
      if (!isSupabaseReady || !session?.user) return;
      const start = new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth(),
        1,
      );
      const end = new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() + 1,
        1,
      );
      try {
        const rows = await fetchTradesForRange(
          session.user.id,
          start.toISOString(),
          end.toISOString(),
        );
        const map = new Map<string, ParsedTrade[]>();
        for (const trade of rows) {
          if (!trade.sessionId) continue;
          const list = map.get(trade.sessionId) ?? [];
          list.push(trade);
          map.set(trade.sessionId, list);
        }
        const pnlMap: Record<string, number> = {};
        for (const [sessionId, tradesForSession] of map.entries()) {
          const summary = calculatePnL(tradesForSession, {});
          pnlMap[sessionId] = summary.realizedPnL;
        }
        setSessionPnL(pnlMap);
      } catch (error) {
        setSyncError(
          error instanceof Error ? error.message : "Ошибка расчёта PnL",
        );
      }
    };
    void loadPnL();
  }, [isSupabaseReady, session?.user?.id, calendarMonth]);

  const calendarDays = useMemo(() => {
    const start = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const startDay = (start.getDay() + 6) % 7;
    const daysInMonth = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + 1,
      0,
    ).getDate();
    const totalCells = 42;

    const days: Array<{
      date: Date | null;
      key: string;
    }> = [];
    for (let i = 0; i < totalCells; i += 1) {
      const dayNumber = i - startDay + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        days.push({ date: null, key: `empty-${i}` });
      } else {
        const date = new Date(
          calendarMonth.getFullYear(),
          calendarMonth.getMonth(),
          dayNumber,
        );
        days.push({ date, key: date.toISOString().slice(0, 10) });
      }
    }
    return days;
  }, [calendarMonth]);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, TradeSession[]>();
    for (const item of sessions) {
      const dateKey = new Date(item.createdAt).toISOString().slice(0, 10);
      const list = map.get(dateKey) ?? [];
      list.push(item);
      map.set(dateKey, list);
    }
    return map;
  }, [sessions]);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("ru-RU", {
        month: "long",
        year: "numeric",
      }).format(calendarMonth),
    [calendarMonth],
  );

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">
              Trade Intelligence
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              Аналитика истории торгов
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-400">
              Загрузите историю, чтобы увидеть фильтры и сводную статистику. PnL
              и цены автоматически обновляются.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-3 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
              <p className="text-xs text-slate-400">Сделок</p>
              <p className="text-xl font-semibold">{filteredTrades.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
              <p className="text-xs text-slate-400">Объём (quote)</p>
              <p className="text-xl font-semibold">
                {totalQuote.toFixed(2)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
              <p className="text-xs text-slate-400">Объём (base)</p>
              <p className="text-xl font-semibold">
                {totalBase.toFixed(4)}
              </p>
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
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
              <p className="text-xs text-slate-400">Синхронизация</p>
              <p className="text-xs text-slate-300">
                {isSyncing
                  ? "Сохраняем..."
                  : session?.user
                    ? "Включена"
                    : "Только локально"}
              </p>
              {syncError && (
                <p className="mt-1 text-xs text-rose-300">{syncError}</p>
              )}
            </div>
            <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
              <AuthPanel session={session} onAuthError={setAuthError} />
            </div>
            <button
              type="button"
              onClick={handleClearData}
              className="rounded-full border border-rose-500/40 px-4 py-2 text-xs text-rose-200 transition hover:border-rose-400 hover:text-rose-100"
            >
              Очистить данные
            </button>
          </div>
        </header>
        {authError && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
            {authError}
          </div>
        )}

        <TradeUploader
          value={rawInput}
          onChange={handleInputChange}
          onParse={handleParse}
          errors={errors}
          maxChars={200_000}
          maxFileBytes={2_000_000}
          onError={handleInputError}
        />
        <p className="text-xs text-slate-500">
          {session?.user
            ? "Данные сохраняются в выбранной сессии и объединяются без дублей."
            : "Войдите, чтобы включить облачное сохранение."}
        </p>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                Сессии трейдов
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Создайте сессию и добавляйте сделки отдельно.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={sessionName}
                onChange={(event) => setSessionName(event.target.value)}
                placeholder="Новая сессия"
                className="rounded-full border border-slate-800 bg-slate-950/70 px-4 py-2 text-sm text-slate-100"
                disabled={!session?.user}
              />
              <button
                type="button"
                onClick={handleCreateSession}
                className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                disabled={!session?.user}
              >
                Создать
              </button>
            </div>
          </div>
          {sessionError && (
            <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
              {sessionError}
            </div>
          )}
          <div className="mt-3 flex items-center gap-3 text-sm text-slate-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoSplitByDate}
                onChange={(event) => setAutoSplitByDate(event.target.checked)}
                disabled={!session?.user}
              />
              Авто‑разбивка по дате
            </label>
            <span className="text-xs text-slate-500">
              Создаёт сессии вида YYYY‑MM‑DD
            </span>
          </div>
          {!session?.user && (
            <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
              Войдите в аккаунт, чтобы активировать сессии.
            </div>
          )}
          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth(
                    new Date(
                      calendarMonth.getFullYear(),
                      calendarMonth.getMonth() - 1,
                      1,
                    ),
                  )
                }
                className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200"
              >
                ←
              </button>
              <p className="text-sm font-semibold text-slate-200">
                {monthLabel}
              </p>
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth(
                    new Date(
                      calendarMonth.getFullYear(),
                      calendarMonth.getMonth() + 1,
                      1,
                    ),
                  )
                }
                className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200"
              >
                →
              </button>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-2 text-xs text-slate-500">
              {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                <div key={day} className="text-center">
                  {day}
                </div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
              {calendarDays.map((cell) => {
                if (!cell.date) {
                  return (
                    <div
                      key={cell.key}
                      className="min-h-[110px] rounded-xl border border-slate-900/50 bg-slate-950/40"
                    />
                  );
                }
                const dateKey = cell.key;
                const daySessions = sessionsByDate.get(dateKey) ?? [];
                return (
                  <div
                    key={cell.key}
                    className="min-h-[110px] rounded-xl border border-slate-800 bg-slate-950/60 p-2"
                  >
                    <div className="text-xs text-slate-400">
                      {cell.date.getDate()}
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                      {daySessions.length === 0 && (
                        <div className="text-[11px] text-slate-600">
                          Нет сессий
                        </div>
                      )}
                      {daySessions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedSessionId(item.id)}
                          className={`rounded-lg border px-2 py-1 text-left text-[11px] transition ${
                            selectedSessionId === item.id
                              ? "border-emerald-400 bg-emerald-500/10 text-emerald-200"
                              : "border-slate-800 bg-slate-900/60 text-slate-200 hover:border-slate-600"
                          }`}
                        >
                          <div className="font-semibold">{item.name}</div>
                          <div
                            className={`text-[10px] ${
                              (sessionPnL[item.id] ?? 0) >= 0
                                ? "text-emerald-300"
                                : "text-rose-300"
                            }`}
                          >
                            PnL: {(sessionPnL[item.id] ?? 0).toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {new Date(item.createdAt).toLocaleTimeString("ru-RU", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {session?.user && !selectedSessionId && (
            <p className="mt-2 text-xs text-rose-300">
              Активная сессия не выбрана.
            </p>
          )}
          {selectedSessionId && (
            <div className="mt-3">
              <Link
                href={`/sessions/${selectedSessionId}`}
                className="inline-flex rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-200 transition hover:border-slate-500"
              >
                Открыть сессию
              </Link>
            </div>
          )}
        </section>

        <TradeFilters
          trades={trades}
          filters={filters}
          onChange={setFilters}
        />

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                Текущие цены (Binance)
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Обновляется автоматически при изменении списка символов.
              </p>
            </div>
            <button
              type="button"
              onClick={loadPrices}
              className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-200 transition hover:border-slate-500"
            >
              {isLoadingPrices ? "Обновляем..." : "Обновить"}
            </button>
          </div>

          {priceError && (
            <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
              {priceError}
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {symbols.length === 0 && (
              <div className="text-sm text-slate-500">
                Нет символов для загрузки цен.
              </div>
            )}
            {symbols.map((symbol) => {
              const quote = prices[symbol];
              return (
                <div
                  key={symbol}
                  className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3"
                >
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {symbol}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-100">
                    {quote ? quote.price.toFixed(4) : "—"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {quote
                      ? new Date(quote.updatedAt).toLocaleTimeString("ru-RU")
                      : "Ожидание данных"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/30">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Позиции</h2>
            <span className="text-sm text-slate-400">
              {pnl.positions.length} открытых
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pnl.positions.length === 0 && (
              <div className="text-sm text-slate-500">
                Нет открытых позиций.
              </div>
            )}
            {pnl.positions.map((position) => (
              <div
                key={position.symbol}
                className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {position.symbol}
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-100">
                  {position.qty.toFixed(4)} @ {position.avgCost.toFixed(4)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Цена рынка:{" "}
                  {position.marketPrice !== undefined
                    ? position.marketPrice.toFixed(4)
                    : "—"}
                </p>
                <p
                  className={`mt-2 text-sm font-semibold ${
                    position.unrealizedPnL >= 0
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  PnL: {position.unrealizedPnL.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <TradeCharts trades={filteredTrades} pnlTimeline={pnlTimeline} />

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/30">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">
              Средняя цена по символам
            </h2>
            <span className="text-sm text-slate-400">
              {avgPrices.perSymbol.length} символов
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {avgPrices.perSymbol.length === 0 && (
              <div className="text-sm text-slate-500">
                Нет данных для расчёта.
              </div>
            )}
            {avgPrices.perSymbol.map((item) => (
              <div
                key={item.symbol}
                className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {item.symbol}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Покупка</p>
                    <p className="font-semibold text-slate-100">
                      {item.avgBuy ? item.avgBuy.toFixed(4) : "—"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Объём: {item.buyQty.toFixed(4)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Продажа</p>
                    <p className="font-semibold text-slate-100">
                      {item.avgSell ? item.avgSell.toFixed(4) : "—"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Объём: {item.sellQty.toFixed(4)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <TradeTable trades={filteredTrades} />
      </main>
    </div>
  );
}
