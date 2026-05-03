"use client";

import { Dispatch, SetStateAction } from "react";
import { AppState, MONTHS, Month } from "@/lib/types";
import { fmt, num, safeDiv } from "@/lib/calc";
import { Card } from "@/components/ui/Card";
import { NumberInput } from "@/components/ui/NumberInput";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Bar, CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

type Props = { state: AppState; setState: Dispatch<SetStateAction<AppState>> };

export default function RevenueTab({ state, setState }: Props) {
  const { finance } = state;

  const totals = MONTHS.reduce(
    (acc, m) => {
      const row = finance.monthly[m];
      acc.goal += num(row.goal);
      acc.actual += num(row.actual);
      acc.costs += num(row.costs);
      return acc;
    },
    { goal: 0, actual: 0, costs: 0 },
  );
  const profit = totals.actual - totals.costs;
  const goalPct = safeDiv(totals.actual, totals.goal);

  const updateMonth = (m: Month, field: "goal" | "actual" | "costs", value: number | null) => {
    setState((s) => ({
      ...s,
      finance: {
        ...s.finance,
        monthly: {
          ...s.finance.monthly,
          [m]: { ...s.finance.monthly[m], [field]: field === "goal" ? (value ?? 0) : value },
        },
      },
    }));
  };

  const monthChart = MONTHS.map((m) => ({
    month: m,
    goal: finance.monthly[m].goal,
    actual: num(finance.monthly[m].actual),
    costs: num(finance.monthly[m].costs),
    profit: num(finance.monthly[m].actual) - num(finance.monthly[m].costs),
  }));

  return (
    <div className="grid gap-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Revenue goal (year)" value={fmt(totals.goal, "currency")} />
        <KPI label="Revenue actual" value={fmt(totals.actual, "currency")} accent />
        <KPI label="Costs" value={fmt(totals.costs, "currency")} />
        <KPI label="Profit" value={fmt(profit, "currency")} positive={profit >= 0} />
      </div>

      <Card title="Goal progress">
        <div className="flex items-center gap-4">
          <div className="flex-1"><ProgressBar pct={goalPct} /></div>
          <div className="text-sm text-muted tabular-nums">{(goalPct * 100).toFixed(1)}%</div>
        </div>
      </Card>

      {/* Monthly entry */}
      <Card title="Monthly revenue, costs & profit" subtitle="Fill goal, actual revenue and costs per month.">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 pr-4 text-left font-medium">Month</th>
                <th className="py-2 px-2 text-right font-medium">Goal</th>
                <th className="py-2 px-2 text-right font-medium">Actual</th>
                <th className="py-2 px-2 text-right font-medium">% of goal</th>
                <th className="py-2 px-2 text-right font-medium">Costs</th>
                <th className="py-2 px-2 text-right font-medium">Profit</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((m) => {
                const row = finance.monthly[m];
                const pct = safeDiv(num(row.actual), num(row.goal));
                const monthProfit = num(row.actual) - num(row.costs);
                return (
                  <tr key={m} className="border-t border-border/40 hover:bg-panel2/40">
                    <td className="py-2 pr-4 text-text/90">{m}</td>
                    <td className="py-2 px-2"><NumberInput value={row.goal} onChange={(v) => updateMonth(m, "goal", v ?? 0)} prefix="$" className="w-32 ml-auto" /></td>
                    <td className="py-2 px-2"><NumberInput value={row.actual} onChange={(v) => updateMonth(m, "actual", v)} prefix="$" className="w-32 ml-auto" /></td>
                    <td className="py-2 px-2 text-right tabular-nums text-muted">{(pct * 100).toFixed(0)}%</td>
                    <td className="py-2 px-2"><NumberInput value={row.costs} onChange={(v) => updateMonth(m, "costs", v)} prefix="$" className="w-32 ml-auto" /></td>
                    <td className={`py-2 px-2 text-right tabular-nums ${monthProfit >= 0 ? "text-good" : "text-bad"}`}>{fmt(monthProfit, "currency")}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-border font-medium">
                <td className="py-2 pr-4">Total</td>
                <td className="py-2 px-2 text-right tabular-nums">{fmt(totals.goal, "currency")}</td>
                <td className="py-2 px-2 text-right tabular-nums">{fmt(totals.actual, "currency")}</td>
                <td className="py-2 px-2 text-right tabular-nums text-muted">{(goalPct * 100).toFixed(0)}%</td>
                <td className="py-2 px-2 text-right tabular-nums">{fmt(totals.costs, "currency")}</td>
                <td className={`py-2 px-2 text-right tabular-nums ${profit >= 0 ? "text-good" : "text-bad"}`}>{fmt(profit, "currency")}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="h-72 mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthChart}>
              <CartesianGrid stroke="#262c36" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" stroke="#8a93a3" fontSize={12} />
              <YAxis stroke="#8a93a3" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "#14171c", border: "1px solid #262c36", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => fmt(v, "currency")}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="goal" name="Goal" fill="#262c36" />
              <Bar dataKey="actual" name="Actual" fill="#7c5cff" />
              <Bar dataKey="costs" name="Costs" fill="#ef4444" />
              <Line type="monotone" dataKey="profit" name="Profit" stroke="#22c55e" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function KPI({ label, value, accent, positive }: { label: string; value: string; accent?: boolean; positive?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "bg-accent/10 border-accent/40" : "bg-panel border-border"}`}>
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className={`text-2xl font-semibold mt-1 tabular-nums ${positive === undefined ? "" : positive ? "text-good" : "text-bad"}`}>{value}</div>
    </div>
  );
}
