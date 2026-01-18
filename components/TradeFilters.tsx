import { ParsedTrade } from "../lib/parseTrades";

export type TradeFiltersState = {
  symbol: string;
  side: "All" | "Buy" | "Sell";
  marketType: string;
  orderType: string;
  dateFrom: string;
  dateTo: string;
  minPrice: string;
  maxPrice: string;
  minQty: string;
  maxQty: string;
};

type TradeFiltersProps = {
  trades: ParsedTrade[];
  filters: TradeFiltersState;
  onChange: (next: TradeFiltersState) => void;
};

const uniqueValues = (values: string[]) =>
  Array.from(new Set(values)).filter(Boolean);

export const TradeFilters = ({ trades, filters, onChange }: TradeFiltersProps) => {
  const symbols = uniqueValues(trades.map((trade) => trade.symbol));
  const marketTypes = uniqueValues(trades.map((trade) => trade.marketType));
  const orderTypes = uniqueValues(trades.map((trade) => trade.orderType));

  const set = (patch: Partial<TradeFiltersState>) =>
    onChange({ ...filters, ...patch });

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/30">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">Фильтры</h2>
        <button
          type="button"
          onClick={() =>
            onChange({
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
            })
          }
          className="text-xs text-slate-400 transition hover:text-slate-200"
        >
          Сбросить
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="flex flex-col gap-2 text-xs uppercase tracking-wide text-slate-400">
          Символ
          <select
            value={filters.symbol}
            onChange={(event) => set({ symbol: event.target.value })}
            className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
          >
            <option value="All">Все</option>
            {symbols.map((symbol) => (
              <option key={symbol} value={symbol}>
                {symbol}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-xs uppercase tracking-wide text-slate-400">
          Сторона
          <select
            value={filters.side}
            onChange={(event) =>
              set({ side: event.target.value as TradeFiltersState["side"] })
            }
            className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
          >
            <option value="All">Все</option>
            <option value="Buy">Buy</option>
            <option value="Sell">Sell</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-xs uppercase tracking-wide text-slate-400">
          Рынок
          <select
            value={filters.marketType}
            onChange={(event) => set({ marketType: event.target.value })}
            className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
          >
            <option value="All">Все</option>
            {marketTypes.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-xs uppercase tracking-wide text-slate-400">
          Тип
          <select
            value={filters.orderType}
            onChange={(event) => set({ orderType: event.target.value })}
            className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
          >
            <option value="All">Все</option>
            {orderTypes.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-xs uppercase tracking-wide text-slate-400">
          Дата от
          <input
            type="datetime-local"
            value={filters.dateFrom}
            onChange={(event) => set({ dateFrom: event.target.value })}
            className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-2 text-xs uppercase tracking-wide text-slate-400">
          Дата до
          <input
            type="datetime-local"
            value={filters.dateTo}
            onChange={(event) => set({ dateTo: event.target.value })}
            className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-2 text-xs uppercase tracking-wide text-slate-400">
          Цена от
          <input
            type="number"
            value={filters.minPrice}
            onChange={(event) => set({ minPrice: event.target.value })}
            className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-2 text-xs uppercase tracking-wide text-slate-400">
          Цена до
          <input
            type="number"
            value={filters.maxPrice}
            onChange={(event) => set({ maxPrice: event.target.value })}
            className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-2 text-xs uppercase tracking-wide text-slate-400">
          Кол-во от
          <input
            type="number"
            value={filters.minQty}
            onChange={(event) => set({ minQty: event.target.value })}
            className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-2 text-xs uppercase tracking-wide text-slate-400">
          Кол-во до
          <input
            type="number"
            value={filters.maxQty}
            onChange={(event) => set({ maxQty: event.target.value })}
            className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
          />
        </label>
      </div>
    </section>
  );
};
