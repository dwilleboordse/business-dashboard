"use client";

import { AppState, LEAD_STATUSES, LeadStatus, MONTHS, OPEN_STATUSES, SOCIAL_METRICS } from "@/lib/types";
import { activeMetrics, fmt, metricTotal, num, safeDiv } from "@/lib/calc";
import { isOverdue, openPipelineValue, weightedPipelineValue, winRate } from "@/lib/leads";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const STATUS_COLORS: Record<LeadStatus, string> = {
  "Check in later": "#64748b",
  "Proposal sent": "#7c5cff",
  "Negotiating": "#f59e0b",
  "Won": "#22c55e",
  "Lost": "#ef4444",
};

export default function OverviewTab({ state }: { state: AppState }) {
  // Finance summary
  const totals = MONTHS.reduce(
    (acc, m) => {
      const r = state.finance.monthly[m];
      acc.goal += num(r.goal);
      acc.actual += num(r.actual);
      acc.costs += num(r.costs);
      return acc;
    },
    { goal: 0, actual: 0, costs: 0 },
  );
  const profit = totals.actual - totals.costs;
  const goalPct = safeDiv(totals.actual, totals.goal);

  // Socials key metrics
  const m = (id: string) => SOCIAL_METRICS.find((x) => x.id === id)!;
  const followersIG = metricTotal(m("ig_followers"), state.socials.weeks);
  const followersLI = metricTotal(m("li_followers"), state.socials.weeks);
  const callsTotal = metricTotal(m("calls_total"), state.socials.weeks);
  const proposalsAccepted = metricTotal(m("proposals_accepted"), state.socials.weeks);
  const adSpend = metricTotal(m("ad_spend"), state.socials.weeks);

  // Email key metrics
  const allEmails = MONTHS.flatMap((mm) => state.emails.emailsByMonth[mm] || []);
  const emailRevenue = allEmails.reduce((s, e) => s + num(e.revenue), 0);
  const subsCurrent = (() => {
    for (let i = MONTHS.length - 1; i >= 0; i--) {
      const v = state.emails.monthlySubscribers[MONTHS[i]];
      if (v != null) return v;
    }
    return 0;
  })();

  // Active socials targets snapshot
  const topMetrics = activeMetrics(state.socials).slice(0, 6);

  // Monthly profit chart
  const monthlyProfit = MONTHS.map((mm) => {
    const r = state.finance.monthly[mm];
    return { month: mm, profit: num(r.actual) - num(r.costs) };
  });

  // Leads
  const leads = state.leadsState.leads;
  const overdueCount = leads.filter((l) => OPEN_STATUSES.includes(l.status) && isOverdue(l.nextFollowUp)).length;
  const pipelineByStage = LEAD_STATUSES.map((s) => {
    const items = leads.filter((l) => l.status === s);
    return { stage: s, count: items.length, value: items.reduce((sum, l) => sum + (l.value ?? 0), 0) };
  });

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Revenue YTD" value={fmt(totals.actual, "currency")} accent />
        <KPI label="Profit YTD" value={fmt(profit, "currency")} positive={profit >= 0} />
        <KPI label="Open pipeline" value={fmt(openPipelineValue(leads), "currency")} />
        <KPI label="Email subscribers" value={fmt(subsCurrent)} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card title="Yearly revenue goal" className="lg:col-span-1">
          <div className="text-3xl font-semibold tabular-nums">{(goalPct * 100).toFixed(1)}%</div>
          <div className="text-sm text-muted mt-1">{fmt(totals.actual, "currency")} of {fmt(totals.goal, "currency")}</div>
          <div className="mt-4"><ProgressBar pct={goalPct} /></div>
        </Card>

        <Card title="Profit per month" className="lg:col-span-2">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyProfit}>
                <CartesianGrid stroke="#262c36" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" stroke="#8a93a3" fontSize={12} />
                <YAxis stroke="#8a93a3" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "#14171c", border: "1px solid #262c36", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => fmt(v, "currency")}
                />
                <Bar dataKey="profit" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Pipeline snapshot" subtitle={`${leads.length} leads · weighted ${fmt(weightedPipelineValue(leads), "currency")} · win rate ${(winRate(leads) * 100).toFixed(0)}%${overdueCount > 0 ? ` · ${overdueCount} overdue follow-up${overdueCount === 1 ? "" : "s"}` : ""}`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {pipelineByStage.map((p) => (
            <div key={p.stage} className="bg-panel2 border border-border rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[p.stage as LeadStatus] }} />
                <span className="text-xs text-muted truncate">{p.stage}</span>
              </div>
              <div className="text-lg font-semibold tabular-nums mt-1">{p.count}</div>
              <div className="text-xs text-muted tabular-nums">{fmt(p.value, "currency")}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Socials snapshot">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Pill label="Followers IG" value={fmt(followersIG)} />
            <Pill label="Followers LinkedIn" value={fmt(followersLI)} />
            <Pill label="Calls booked" value={fmt(callsTotal)} />
            <Pill label="Proposals accepted" value={fmt(proposalsAccepted)} />
          </div>
          <div className="space-y-2">
            {topMetrics.map((m) => {
              const total = metricTotal(m, state.socials.weeks);
              const target = state.socials.targets[m.id];
              const pct = target ? total / target : 0;
              return (
                <div key={m.id} className="flex items-center gap-3 text-sm">
                  <div className="w-48 truncate text-text/80">{m.label}</div>
                  <div className="flex-1"><ProgressBar pct={pct} /></div>
                  <div className="w-12 text-right text-muted tabular-nums">{(pct * 100).toFixed(0)}%</div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Email snapshot">
          <div className="grid grid-cols-2 gap-3">
            <Pill label="Subscribers" value={fmt(subsCurrent)} />
            <Pill label="Emails sent (year)" value={fmt(allEmails.length)} />
            <Pill label="Revenue from email" value={fmt(emailRevenue, "currency")} />
            <Pill label="Avg open" value={
              (() => {
                const opens = allEmails.map((e) => e.openPct).filter((v): v is number => typeof v === "number");
                return opens.length ? `${(opens.reduce((s, v) => s + v, 0) / opens.length * 100).toFixed(1)}%` : "—";
              })()
            } />
          </div>
        </Card>
      </div>
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

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-panel2 border border-border rounded-lg p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
