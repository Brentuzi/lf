import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ParsedTrade } from "../lib/parseTrades";
import { PnLPoint } from "../lib/pnl";

type TradeChartsProps = {
  trades: ParsedTrade[];
  pnlTimeline: PnLPoint[];
};

const buildTradeSeries = (trades: ParsedTrade[]) =>
  [...trades]
    .sort((a, b) => {
      const left = a.time ? new Date(a.time.replace(" ", "T")).getTime() : 0;
      const right = b.time ? new Date(b.time.replace(" ", "T")).getTime() : 0;
      return left - right;
    })
    .map((trade) => ({
      time: trade.time ?? "—",
      price: trade.price,
      quote: trade.quoteAmount,
      base: trade.baseAmount,
    }));

export const TradeCharts = ({ trades, pnlTimeline }: TradeChartsProps) => {
  const series = buildTradeSeries(trades);

  return (
    <section className="grid gap-4 xl:grid-cols-3">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-slate-950/30">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Цена</h3>
          <span className="text-xs text-slate-500">trade price</span>
        </div>
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="time" hide />
              <YAxis
                domain={["dataMin", "dataMax"]}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", border: "none" }}
                labelStyle={{ color: "#94a3b8" }}
                formatter={(value) =>
                  value === undefined || value === null
                    ? "—"
                    : Number(value).toFixed(4)
                }
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-slate-950/30">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Объём</h3>
          <span className="text-xs text-slate-500">quote amount</span>
        </div>
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="time" hide />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                domain={[0, "dataMax"]}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", border: "none" }}
                labelStyle={{ color: "#94a3b8" }}
                formatter={(value) =>
                  value === undefined || value === null
                    ? "—"
                    : Number(value).toFixed(2)
                }
              />
              <Bar dataKey="quote" fill="#34d399" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-slate-950/30">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">PnL</h3>
          <span className="text-xs text-slate-500">cumulative</span>
        </div>
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={pnlTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="time" hide />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                domain={["dataMin", "dataMax"]}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", border: "none" }}
                labelStyle={{ color: "#94a3b8" }}
                formatter={(value) =>
                  value === undefined || value === null
                    ? "—"
                    : Number(value).toFixed(2)
                }
              />
              <Area
                type="monotone"
                dataKey="realizedPnL"
                stroke="#f97316"
                fill="#f9731633"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};
