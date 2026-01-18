import { ParsedTrade } from "../lib/parseTrades";
import { tradeKey } from "../lib/mergeTrades";

const numberFormat = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 8,
});

type TradeTableProps = {
  trades: ParsedTrade[];
};

export const TradeTable = ({ trades }: TradeTableProps) => (
  <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/30">
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold text-slate-100">Сделки</h2>
      <span className="text-sm text-slate-400">
        {trades.length} записей
      </span>
    </div>
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full text-left text-sm text-slate-200">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr className="border-b border-slate-800">
            <th className="px-3 py-2">Время</th>
            <th className="px-3 py-2">Символ</th>
            <th className="px-3 py-2">Side</th>
            <th className="px-3 py-2">Цена</th>
            <th className="px-3 py-2">Кол-во</th>
            <th className="px-3 py-2">Сумма</th>
            <th className="px-3 py-2">Комиссия</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade, index) => (
            <tr
              key={`${tradeKey(trade)}-${index}`}
              className="border-b border-slate-900/60 hover:bg-slate-900/80"
            >
              <td className="px-3 py-2 text-slate-400">{trade.time ?? "—"}</td>
              <td className="px-3 py-2 font-semibold">{trade.symbol}</td>
              <td
                className={`px-3 py-2 font-semibold ${
                  trade.side === "Buy" ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {trade.side}
              </td>
              <td className="px-3 py-2">
                {numberFormat.format(trade.price)} {trade.priceAsset}
              </td>
              <td className="px-3 py-2">
                {numberFormat.format(trade.baseAmount)} {trade.baseAsset}
              </td>
              <td className="px-3 py-2">
                {numberFormat.format(trade.quoteAmount)} {trade.quoteAsset}
              </td>
              <td className="px-3 py-2 text-slate-400">
                {trade.feeAmount !== undefined
                  ? `${numberFormat.format(trade.feeAmount)} ${trade.feeAsset}`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {trades.length === 0 && (
        <div className="py-10 text-center text-sm text-slate-500">
          Нет данных — загрузите историю торгов.
        </div>
      )}
    </div>
  </section>
);
