"use client";

import { Dispatch, Fragment, SetStateAction, useMemo, useState } from "react";
import { AppState, CHANNELS, Channel, MONTHS, SocialMetric, WeeklyValues } from "@/lib/types";
import { activeMetrics, fmt, metricTotal, monthlyRollup, weeklySeries } from "@/lib/calc";
import { Card } from "@/components/ui/Card";
import { NumberInput } from "@/components/ui/NumberInput";
import { ProgressBar, StatusDot } from "@/components/ui/ProgressBar";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

type Props = {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
};

function getCurrentWeekIndex(year: number): number {
  const start = new Date(Date.UTC(year, 0, 1));
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return Math.max(0, Math.min(51, Math.floor(diffDays / 7)));
}

export default function SocialsTab({ state, setState }: Props) {
  const [activeWeek, setActiveWeek] = useState(() => getCurrentWeekIndex(state.year));

  const metrics = activeMetrics(state.socials);
  const groups = useMemo(() => {
    const g: Record<string, SocialMetric[]> = {};
    for (const m of metrics) (g[m.group] ||= []).push(m);
    return g;
  }, [metrics]);

  const updateChannel = (ch: Channel, on: boolean) => {
    setState((s) => ({ ...s, socials: { ...s.socials, channels: { ...s.socials.channels, [ch]: on } } }));
  };

  const updateWeekValue = (weekIdx: number, metricId: string, value: number | null) => {
    setState((s) => {
      const weeks = s.socials.weeks.slice();
      weeks[weekIdx] = { ...weeks[weekIdx], [metricId]: value };
      return { ...s, socials: { ...s.socials, weeks } };
    });
  };

  const updateTarget = (metricId: string, target: number) => {
    setState((s) => ({
      ...s,
      socials: { ...s.socials, targets: { ...s.socials.targets, [metricId]: target } },
    }));
  };

  return (
    <div className="grid gap-6">
      {/* Channels */}
      <Card title="Active channels" subtitle="Toggle the platforms you actively track. Hidden ones are kept in storage but stay out of charts and tables.">
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((ch) => {
            const on = state.socials.channels[ch];
            return (
              <button
                key={ch}
                onClick={() => updateChannel(ch, !on)}
                className={`px-3 py-1.5 rounded-lg border text-sm transition ${
                  on ? "border-accent bg-accent/15 text-text" : "border-border bg-panel2 text-muted hover:text-text"
                }`}
              >
                {ch}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Weekly entry — Monday focus */}
      <Card
        title="Weekly entry"
        subtitle="Pick the week, fill the numbers. Tab between fields. Press Enter to save."
        right={
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => setActiveWeek(Math.max(0, activeWeek - 1))}
              className="px-2 py-1 rounded-md bg-panel2 border border-border hover:border-accent"
            >
              ←
            </button>
            <select
              value={activeWeek}
              onChange={(e) => setActiveWeek(Number(e.target.value))}
              className="bg-panel2 border border-border rounded-md px-2 py-1"
            >
              {Array.from({ length: 52 }).map((_, i) => (
                <option key={i} value={i}>Week {i + 1}</option>
              ))}
            </select>
            <button
              onClick={() => setActiveWeek(Math.min(51, activeWeek + 1))}
              className="px-2 py-1 rounded-md bg-panel2 border border-border hover:border-accent"
            >
              →
            </button>
          </div>
        }
      >
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
          {Object.entries(groups).map(([group, ms]) => (
            <div key={group} className="space-y-2">
              <h4 className="text-xs uppercase tracking-wider text-muted">{group}</h4>
              {ms.map((m) => {
                const computed = m.total === "computed";
                return (
                  <div key={m.id} className="flex items-center gap-3">
                    <label className="text-sm text-text/80 flex-1 truncate" title={m.label}>{m.label}</label>
                    {computed ? (
                      <span className="text-sm text-muted w-32 text-right">{fmt(weeklyComputedValue(m, state.socials.weeks[activeWeek]), m.unit)}</span>
                    ) : (
                      <NumberInput
                        value={state.socials.weeks[activeWeek]?.[m.id] ?? null}
                        onChange={(v) => updateWeekValue(activeWeek, m.id, v)}
                        className="w-32"
                        prefix={m.unit === "currency" ? "$" : undefined}
                        suffix={m.unit === "percent" ? "%" : undefined}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      {/* Yearly progress table */}
      <Card title="Year progress" subtitle="Total / target with traffic-light status.">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="text-muted text-left">
              <tr>
                <th className="py-2 pr-4 font-medium">Metric</th>
                <th className="py-2 px-4 font-medium text-right">Total</th>
                <th className="py-2 px-4 font-medium text-right">Target</th>
                <th className="py-2 px-4 font-medium w-48">Progress</th>
                <th className="py-2 pl-4 font-medium w-12 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groups).map(([group, ms]) => (
                <Fragment key={group}>
                  <tr className="border-t border-border">
                    <td colSpan={5} className="py-2 text-xs uppercase tracking-wider text-accent2">{group}</td>
                  </tr>
                  {ms.map((m) => {
                    const total = metricTotal(m, state.socials.weeks);
                    const target = state.socials.targets[m.id];
                    const pct = target ? total / target : 0;
                    return (
                      <tr key={m.id} className="border-t border-border/40 hover:bg-panel2/40">
                        <td className="py-2 pr-4">{m.label}</td>
                        <td className="py-2 px-4 text-right tabular-nums">{fmt(total, m.unit)}</td>
                        <td className="py-2 px-4 text-right tabular-nums">
                          <NumberInput
                            value={target}
                            onChange={(v) => updateTarget(m.id, v ?? 0)}
                            className="w-28 ml-auto"
                          />
                        </td>
                        <td className="py-2 px-4">
                          <div className="flex items-center gap-2">
                            <ProgressBar pct={pct} />
                            <span className="text-xs text-muted w-12 text-right tabular-nums">{(pct * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="py-2 pl-4 text-right"><StatusDot pct={pct} /></td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Charts grid for active platform engagement metrics */}
      <Card title="Trends" subtitle="Weekly trend per metric (active channels only).">
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {metrics
            .filter((m) => m.group === "Engagement" && m.total !== "computed")
            .map((m) => (
              <MetricSparkline key={m.id} metric={m} weeks={state.socials.weeks} />
            ))}
        </div>
      </Card>

      {/* Monthly rollup */}
      <Card title="Monthly rollup" subtitle="Aggregated from your weekly entries.">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="text-muted text-left">
              <tr>
                <th className="py-2 pr-4 font-medium">Metric</th>
                {MONTHS.map((m) => <th key={m} className="py-2 px-2 font-medium text-right">{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {metrics.filter((m) => m.total !== "computed").map((m) => {
                const row = monthlyRollup(m, state.socials.weeks, state.year);
                return (
                  <tr key={m.id} className="border-t border-border/40">
                    <td className="py-2 pr-4 truncate max-w-[260px]">{m.label}</td>
                    {row.map((v, i) => (
                      <td key={i} className="py-2 px-2 text-right tabular-nums text-text/80">
                        {v === null ? <span className="text-muted/50">—</span> : fmt(v, m.unit)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function weeklyComputedValue(m: SocialMetric, w: WeeklyValues | undefined): number {
  if (!w || !m.computeFrom) return 0;
  const n = w[m.computeFrom.numerator];
  const d = w[m.computeFrom.denominator];
  if (typeof n !== "number" || typeof d !== "number" || d === 0) return 0;
  return n / d;
}

function MetricSparkline({ metric, weeks }: { metric: SocialMetric; weeks: WeeklyValues[] }) {
  const series = weeklySeries(metric, weeks);
  const last = [...series].reverse().find((p) => p.value !== null)?.value;
  return (
    <div className="bg-panel2 border border-border rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h5 className="text-sm text-text/90 truncate">{metric.label}</h5>
        <span className="text-xs text-muted tabular-nums">{last != null ? fmt(last, metric.unit) : "—"}</span>
      </div>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series}>
            <CartesianGrid stroke="#262c36" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="week" hide />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: "#14171c", border: "1px solid #262c36", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#8a93a3" }}
            />
            <Line type="monotone" dataKey="value" stroke="#7c5cff" strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
