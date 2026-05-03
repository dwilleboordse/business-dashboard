"use client";

import { Dispatch, SetStateAction, useRef, useState } from "react";
import { AppState, EmailEntry, MONTHS, Month } from "@/lib/types";
import { fmt, num } from "@/lib/calc";
import { importACCampaignsFromFile } from "@/lib/emails-import";
import { Card } from "@/components/ui/Card";
import { NumberInput } from "@/components/ui/NumberInput";
import { Bar, BarChart, CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

type Props = { state: AppState; setState: Dispatch<SetStateAction<AppState>> };

export default function EmailsTab({ state, setState }: Props) {
  const [activeMonth, setActiveMonth] = useState<Month>(() => MONTHS[new Date().getMonth()]);
  const subs = state.emails.monthlySubscribers;
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImportCampaigns = async (file: File) => {
    try {
      const before = MONTHS.reduce((s, m) => s + (state.emails.emailsByMonth[m]?.length ?? 0), 0);
      const nextEmails = await importACCampaignsFromFile(file, state.emails);
      const after = MONTHS.reduce((s, m) => s + (nextEmails.emailsByMonth[m]?.length ?? 0), 0);
      setState((s) => ({ ...s, emails: nextEmails }));
      alert(`Imported ${after - before} new campaigns. Total now: ${after}.`);
    } catch (e) {
      alert(`Could not import file. ${(e as Error).message}`);
    }
  };

  const subsChart = MONTHS.map((m, i) => {
    const cur = subs[m];
    const prev = i > 0 ? subs[MONTHS[i - 1]] : null;
    return {
      month: m,
      subscribers: cur ?? null,
      growth: cur != null && prev != null && prev !== 0 ? (cur - prev) / prev : null,
    };
  });

  const allEmails = MONTHS.flatMap((m) => state.emails.emailsByMonth[m] || []);
  const avgOpen = allEmails.length ? allEmails.reduce((s, e) => s + num(e.openPct), 0) / allEmails.filter((e) => e.openPct != null).length : 0;
  const avgClick = allEmails.length ? allEmails.reduce((s, e) => s + num(e.clickPct), 0) / allEmails.filter((e) => e.clickPct != null).length : 0;
  const totalRevenue = allEmails.reduce((s, e) => s + num(e.revenue), 0);
  const totalUnsubs = allEmails.reduce((s, e) => s + num(e.unsubs), 0);

  const updateSubs = (m: Month, value: number | null) => {
    setState((s) => ({
      ...s,
      emails: { ...s.emails, monthlySubscribers: { ...s.emails.monthlySubscribers, [m]: value } },
    }));
  };

  const updateEmail = (m: Month, idx: number, patch: Partial<EmailEntry>) => {
    setState((s) => {
      const list = (s.emails.emailsByMonth[m] || []).slice();
      list[idx] = { ...list[idx], ...patch };
      return { ...s, emails: { ...s.emails, emailsByMonth: { ...s.emails.emailsByMonth, [m]: list } } };
    });
  };

  const addEmail = (m: Month) => {
    setState((s) => {
      const list = (s.emails.emailsByMonth[m] || []).slice();
      list.push({
        date: new Date().toISOString().slice(0, 10),
        name: "",
        openPct: null,
        clickPct: null,
        unsubs: null,
        revenue: null,
        link: "",
      });
      return { ...s, emails: { ...s.emails, emailsByMonth: { ...s.emails.emailsByMonth, [m]: list } } };
    });
  };

  const removeEmail = (m: Month, idx: number) => {
    setState((s) => {
      const list = (s.emails.emailsByMonth[m] || []).filter((_, i) => i !== idx);
      return { ...s, emails: { ...s.emails, emailsByMonth: { ...s.emails.emailsByMonth, [m]: list } } };
    });
  };

  const monthEmails = state.emails.emailsByMonth[activeMonth] || [];

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Avg open rate" value={Number.isFinite(avgOpen) ? `${(avgOpen * 100).toFixed(1)}%` : "—"} />
        <KPI label="Avg click rate" value={Number.isFinite(avgClick) ? `${(avgClick * 100).toFixed(2)}%` : "—"} />
        <KPI label="Email revenue" value={fmt(totalRevenue, "currency")} />
        <KPI label="Unsubscribes" value={fmt(totalUnsubs)} />
      </div>

      {/* Monthly subscribers */}
      <Card title="Subscribers per month" subtitle="Total list size at month-end.">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {MONTHS.map((m) => (
            <div key={m} className="bg-panel2 border border-border rounded-lg p-3">
              <div className="text-xs uppercase tracking-wider text-muted">{m}</div>
              <NumberInput value={subs[m]} onChange={(v) => updateSubs(m, v)} className="mt-1" />
            </div>
          ))}
        </div>

        <div className="h-64 mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={subsChart}>
              <CartesianGrid stroke="#262c36" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" stroke="#8a93a3" fontSize={12} />
              <YAxis yAxisId="left" stroke="#8a93a3" fontSize={12} />
              <YAxis yAxisId="right" orientation="right" stroke="#8a93a3" fontSize={12} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip
                contentStyle={{ background: "#14171c", border: "1px solid #262c36", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, name: string) => name === "growth" ? `${(v * 100).toFixed(2)}%` : fmt(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="subscribers" name="Subscribers" fill="#22d3ee" />
              <Line yAxisId="right" type="monotone" dataKey="growth" name="MoM growth" stroke="#7c5cff" strokeWidth={2} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Per-email entries */}
      <Card
        title="Email performance"
        subtitle="Log each email you send. Import an ActiveCampaign export to bulk-load campaigns."
        right={
          <div className="flex items-center gap-2">
            <select
              value={activeMonth}
              onChange={(e) => setActiveMonth(e.target.value as Month)}
              className="bg-panel2 border border-border rounded-md px-2 py-1 text-sm"
            >
              {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <button
              onClick={() => importInputRef.current?.click()}
              className="text-sm px-3 py-1 rounded-md bg-panel2 border border-border hover:border-accent"
              title="Import an ActiveCampaign 'All Campaigns Performance Report' CSV"
            >
              Import campaigns
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportCampaigns(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => addEmail(activeMonth)}
              className="text-sm px-3 py-1 rounded-md bg-accent text-white hover:opacity-90"
            >
              + Add email
            </button>
          </div>
        }
      >
        {monthEmails.length === 0 ? (
          <div className="text-muted text-sm py-8 text-center">No emails logged for {activeMonth}. Click <span className="text-text">+ Add email</span> to start.</div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="py-2 pr-2 text-left font-medium">Date</th>
                  <th className="py-2 px-2 text-left font-medium">Name</th>
                  <th className="py-2 px-2 text-right font-medium">Open %</th>
                  <th className="py-2 px-2 text-right font-medium">Click %</th>
                  <th className="py-2 px-2 text-right font-medium">Unsubs</th>
                  <th className="py-2 px-2 text-right font-medium">Revenue</th>
                  <th className="py-2 px-2 text-left font-medium">Link</th>
                  <th className="py-2 pl-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {monthEmails.map((e, i) => (
                  <tr key={i} className="border-t border-border/40 hover:bg-panel2/40">
                    <td className="py-2 pr-2">
                      <input
                        type="date"
                        value={e.date}
                        onChange={(ev) => updateEmail(activeMonth, i, { date: ev.target.value })}
                        className="bg-panel2 border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:border-accent"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        value={e.name}
                        placeholder="Subject line"
                        onChange={(ev) => updateEmail(activeMonth, i, { name: ev.target.value })}
                        className="bg-panel2 border border-border rounded-md px-2 py-1 text-sm w-full focus:outline-none focus:border-accent"
                      />
                    </td>
                    <td className="py-2 px-2"><NumberInput value={e.openPct == null ? null : Math.round(e.openPct * 1000) / 10} onChange={(v) => updateEmail(activeMonth, i, { openPct: v == null ? null : v / 100 })} suffix="%" className="w-24 ml-auto" /></td>
                    <td className="py-2 px-2"><NumberInput value={e.clickPct == null ? null : Math.round(e.clickPct * 1000) / 10} onChange={(v) => updateEmail(activeMonth, i, { clickPct: v == null ? null : v / 100 })} suffix="%" className="w-24 ml-auto" /></td>
                    <td className="py-2 px-2"><NumberInput value={e.unsubs} onChange={(v) => updateEmail(activeMonth, i, { unsubs: v })} className="w-20 ml-auto" /></td>
                    <td className="py-2 px-2"><NumberInput value={e.revenue} onChange={(v) => updateEmail(activeMonth, i, { revenue: v })} prefix="$" className="w-28 ml-auto" /></td>
                    <td className="py-2 px-2">
                      <input
                        value={e.link ?? ""}
                        placeholder="https://..."
                        onChange={(ev) => updateEmail(activeMonth, i, { link: ev.target.value })}
                        className="bg-panel2 border border-border rounded-md px-2 py-1 text-sm w-full focus:outline-none focus:border-accent"
                      />
                    </td>
                    <td className="py-2 pl-2 text-right">
                      <button onClick={() => removeEmail(activeMonth, i)} className="text-muted hover:text-bad text-xs">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-panel border-border p-4">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}
