"use client";

import { Dispatch, SetStateAction, useMemo, useRef, useState } from "react";
import { AppState, LEAD_STATUSES, Lead, LeadStatus, OPEN_STATUSES } from "@/lib/types";
import {
  importLeadsFromFile, isOverdue, newLead,
  openPipelineValue, weightedPipelineValue, winRate, wonValue,
} from "@/lib/leads";
import { fmt } from "@/lib/calc";
import { Card } from "@/components/ui/Card";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Props = { state: AppState; setState: Dispatch<SetStateAction<AppState>> };

type View = "Pipeline" | "Table" | "Follow-ups" | "Analytics";

const STATUS_COLORS: Record<LeadStatus, string> = {
  "Check in later": "#64748b",
  "Proposal sent": "#7c5cff",
  "Negotiating": "#f59e0b",
  "Won": "#22c55e",
  "Lost": "#ef4444",
};

export default function LeadsTab({ state, setState }: Props) {
  const [view, setView] = useState<View>("Pipeline");
  const [editing, setEditing] = useState<Lead | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const leads = state.leadsState.leads;
  const sources = useMemo(() => Array.from(new Set(leads.map((l) => l.source).filter(Boolean))).sort(), [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (sourceFilter && l.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.source.toLowerCase().includes(q) ||
        l.contactName.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.notes.toLowerCase().includes(q)
      );
    });
  }, [leads, search, sourceFilter]);

  const setLeads = (updater: (leads: Lead[]) => Lead[]) => {
    setState((s) => ({ ...s, leadsState: { ...s.leadsState, leads: updater(s.leadsState.leads) } }));
  };

  const upsertLead = (lead: Lead) => {
    setLeads((existing) => {
      const idx = existing.findIndex((l) => l.id === lead.id);
      const next = { ...lead, updatedAt: new Date().toISOString().slice(0, 10) };
      if (idx === -1) return [...existing, next];
      const copy = existing.slice();
      copy[idx] = next;
      return copy;
    });
  };

  const deleteLead = (id: string) => {
    setLeads((existing) => existing.filter((l) => l.id !== id));
  };

  const handleImport = async (file: File) => {
    try {
      const merged = await importLeadsFromFile(file, leads);
      setLeads(() => merged);
      alert(`Imported. Total leads: ${merged.length}`);
    } catch (e) {
      alert(`Could not import file. ${(e as Error).message}`);
    }
  };

  return (
    <div className="grid gap-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPI label="Open pipeline" value={fmt(openPipelineValue(leads), "currency")} />
        <KPI label="Weighted pipeline" value={fmt(weightedPipelineValue(leads), "currency")} accent />
        <KPI label="Won (total)" value={fmt(wonValue(leads), "currency")} />
        <KPI label="Win rate" value={`${(winRate(leads) * 100).toFixed(0)}%`} />
        <KPI label="Total leads" value={fmt(leads.length)} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-panel border border-border rounded-xl p-1">
          {(["Pipeline", "Table", "Follow-ups", "Analytics"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-sm rounded-lg transition ${view === v ? "bg-accent text-white" : "text-muted hover:text-text"}`}
            >
              {v}
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, notes…"
          className="bg-panel2 border border-border rounded-md px-3 py-1.5 text-sm w-64 focus:outline-none focus:border-accent"
        />
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="bg-panel2 border border-border rounded-md px-2 py-1.5 text-sm"
        >
          <option value="">All sources</option>
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="flex-1" />
        <button
          onClick={() => setEditing(newLead())}
          className="text-sm px-3 py-1.5 rounded-md bg-accent text-white hover:opacity-90"
        >
          + New lead
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="text-sm px-3 py-1.5 rounded-md bg-panel border border-border hover:border-accent"
          title="Import from leads-import.json or a ClickUp CSV"
        >
          Import leads
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.target.value = "";
          }}
        />
      </div>

      {view === "Pipeline" && <PipelineView leads={filtered} onSelect={setEditing} onDrop={(id, status) => {
        const lead = leads.find((l) => l.id === id);
        if (lead) upsertLead({ ...lead, status });
      }} />}

      {view === "Table" && <TableView leads={filtered} onSelect={setEditing} />}

      {view === "Follow-ups" && <FollowUpsView leads={filtered} onSelect={setEditing} />}

      {view === "Analytics" && <AnalyticsView leads={leads} />}

      {editing && (
        <LeadEditor
          lead={editing}
          existingIds={new Set(leads.map((l) => l.id))}
          onClose={() => setEditing(null)}
          onSave={(l) => { upsertLead(l); setEditing(null); }}
          onDelete={(id) => { deleteLead(id); setEditing(null); }}
        />
      )}
    </div>
  );
}

function KPI({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "bg-accent/10 border-accent/40" : "bg-panel border-border"}`}>
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

/* ---------------------------- Pipeline (Kanban) ---------------------------- */

function PipelineView({
  leads, onSelect, onDrop,
}: {
  leads: Lead[];
  onSelect: (l: Lead) => void;
  onDrop: (id: string, status: LeadStatus) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {LEAD_STATUSES.map((status) => {
        const items = leads.filter((l) => l.status === status);
        const total = items.reduce((s, l) => s + (l.value ?? 0), 0);
        return (
          <div
            key={status}
            className="bg-panel border border-border rounded-2xl p-3 min-h-[300px]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/plain");
              if (id) onDrop(id, status);
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[status] }} />
                <h4 className="text-sm font-semibold">{status}</h4>
                <span className="text-xs text-muted">({items.length})</span>
              </div>
              <span className="text-xs text-muted tabular-nums">{fmt(total, "currency")}</span>
            </div>
            <div className="space-y-2">
              {items.map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", lead.id)}
                  onClick={() => onSelect(lead)}
                  className="bg-panel2 border border-border rounded-lg p-3 cursor-pointer hover:border-accent transition group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm truncate">{lead.name}</div>
                    {lead.value != null && <span className="text-xs text-muted tabular-nums shrink-0">{fmt(lead.value, "currency")}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                    {lead.source && <span className="bg-panel border border-border rounded px-1.5 py-0.5">{lead.source}</span>}
                    {lead.nextFollowUp && (
                      <span className={isOverdue(lead.nextFollowUp) && lead.status !== "Won" && lead.status !== "Lost" ? "text-bad" : ""}>
                        {formatDate(lead.nextFollowUp)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {items.length === 0 && <div className="text-xs text-muted/60 px-2 py-4 text-center">Drop a lead here</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ Table view ------------------------------ */

type SortKey = "name" | "value" | "status" | "source" | "nextFollowUp" | "updatedAt";

function TableView({ leads, onSelect }: { leads: Lead[]; onSelect: (l: Lead) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const arr = leads.slice();
    arr.sort((a, b) => {
      const A = (a[sortKey] ?? "") as string | number;
      const B = (b[sortKey] ?? "") as string | number;
      if (A === B) return 0;
      const cmp = A > B ? 1 : -1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [leads, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const SortHeader = ({ k, label, align = "left" }: { k: SortKey; label: string; align?: "left" | "right" }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`py-2 px-3 font-medium cursor-pointer hover:text-text text-${align}`}
    >
      {label}{sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );

  return (
    <Card>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="text-muted text-left">
            <tr>
              <SortHeader k="name" label="Name" />
              <SortHeader k="status" label="Status" />
              <SortHeader k="source" label="Source" />
              <SortHeader k="value" label="Value" align="right" />
              <SortHeader k="nextFollowUp" label="Next follow-up" />
              <SortHeader k="updatedAt" label="Updated" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => onSelect(lead)}
                className="border-t border-border/40 hover:bg-panel2/40 cursor-pointer"
              >
                <td className="py-2 px-3 font-medium">{lead.name}</td>
                <td className="py-2 px-3">
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${STATUS_COLORS[lead.status]}22`, color: STATUS_COLORS[lead.status] }}>
                    {lead.status}
                  </span>
                </td>
                <td className="py-2 px-3 text-muted">{lead.source || "—"}</td>
                <td className="py-2 px-3 text-right tabular-nums">{lead.value != null ? fmt(lead.value, "currency") : "—"}</td>
                <td className={`py-2 px-3 ${isOverdue(lead.nextFollowUp) && (lead.status !== "Won" && lead.status !== "Lost") ? "text-bad" : "text-muted"}`}>
                  {formatDate(lead.nextFollowUp)}
                </td>
                <td className="py-2 px-3 text-muted">{formatDate(lead.updatedAt)}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-muted">No leads match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ----------------------------- Follow-ups view ----------------------------- */

function FollowUpsView({ leads, onSelect }: { leads: Lead[]; onSelect: (l: Lead) => void }) {
  const open = leads.filter((l) => OPEN_STATUSES.includes(l.status));
  const overdue = open.filter((l) => isOverdue(l.nextFollowUp));
  const upcoming = open
    .filter((l) => l.nextFollowUp && !isOverdue(l.nextFollowUp))
    .sort((a, b) => (a.nextFollowUp! < b.nextFollowUp! ? -1 : 1))
    .slice(0, 30);
  const noDate = open.filter((l) => !l.nextFollowUp);

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card title={`Overdue (${overdue.length})`} subtitle="Follow up today.">
        <FollowUpList leads={overdue} onSelect={onSelect} variant="overdue" />
      </Card>
      <Card title={`Upcoming (${upcoming.length})`} subtitle="Sorted by date.">
        <FollowUpList leads={upcoming} onSelect={onSelect} />
      </Card>
      <Card title={`No follow-up date (${noDate.length})`} subtitle="Add a date to keep these on the radar.">
        <FollowUpList leads={noDate} onSelect={onSelect} variant="muted" />
      </Card>
    </div>
  );
}

function FollowUpList({ leads, onSelect, variant }: { leads: Lead[]; onSelect: (l: Lead) => void; variant?: "overdue" | "muted" }) {
  if (!leads.length) return <div className="text-muted text-sm py-4 text-center">Nothing here.</div>;
  return (
    <div className="space-y-2">
      {leads.map((lead) => (
        <button
          key={lead.id}
          onClick={() => onSelect(lead)}
          className="w-full text-left bg-panel2 border border-border hover:border-accent rounded-lg p-3 transition"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-medium text-sm">{lead.name}</div>
              <div className="text-xs text-muted mt-0.5">{lead.status} · {lead.source || "no source"}</div>
            </div>
            <div className="text-xs tabular-nums text-right">
              <div className={variant === "overdue" ? "text-bad" : variant === "muted" ? "text-muted" : "text-text"}>
                {formatDate(lead.nextFollowUp) || "—"}
              </div>
              {lead.value != null && <div className="text-muted">{fmt(lead.value, "currency")}</div>}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ Analytics view ----------------------------- */

const PIE_COLORS = ["#7c5cff", "#22d3ee", "#22c55e", "#f59e0b", "#ef4444", "#a78bfa", "#34d399", "#fbbf24", "#60a5fa", "#f472b6"];

function AnalyticsView({ leads }: { leads: Lead[] }) {
  const funnel = LEAD_STATUSES.map((s) => {
    const items = leads.filter((l) => l.status === s);
    return { stage: s, count: items.length, value: items.reduce((sum, l) => sum + (l.value ?? 0), 0) };
  });

  const sources = leads.reduce<Record<string, { count: number; value: number }>>((acc, l) => {
    const k = l.source || "(none)";
    acc[k] ||= { count: 0, value: 0 };
    acc[k].count += 1;
    acc[k].value += l.value ?? 0;
    return acc;
  }, {});
  const sourceData = Object.entries(sources)
    .map(([source, v]) => ({ source, ...v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Won deals over time (by closedAt month)
  const monthBuckets: Record<string, number> = {};
  leads.filter((l) => l.status === "Won" && l.closedAt).forEach((l) => {
    const ym = l.closedAt!.slice(0, 7);
    monthBuckets[ym] = (monthBuckets[ym] ?? 0) + (l.value ?? 0);
  });
  const wonOverTime = Object.entries(monthBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({ month, value }));

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card title="Pipeline funnel" subtitle="Lead count and total value per stage.">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnel}>
              <CartesianGrid stroke="#262c36" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="stage" stroke="#8a93a3" fontSize={12} />
              <YAxis yAxisId="left" stroke="#8a93a3" fontSize={12} />
              <YAxis yAxisId="right" orientation="right" stroke="#8a93a3" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "#14171c", border: "1px solid #262c36", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, name: string) => name === "value" ? fmt(v, "currency") : v}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="count" name="Leads" fill="#22d3ee" />
              <Bar yAxisId="right" dataKey="value" name="Value">
                {funnel.map((f, i) => <Cell key={i} fill={STATUS_COLORS[f.stage as LeadStatus]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Top sources" subtitle="By total deal value (top 10).">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={sourceData} dataKey="value" nameKey="source" innerRadius={50} outerRadius={100} paddingAngle={2}>
                {sourceData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#14171c", border: "1px solid #262c36", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => fmt(v, "currency")}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Won deals over time" className="lg:col-span-2">
        {wonOverTime.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted text-sm">No won deals with close dates yet.</div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wonOverTime}>
                <CartesianGrid stroke="#262c36" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" stroke="#8a93a3" fontSize={12} />
                <YAxis stroke="#8a93a3" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "#14171c", border: "1px solid #262c36", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => fmt(v, "currency")}
                />
                <Bar dataKey="value" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------- Lead editor ------------------------------ */

function LeadEditor({
  lead, existingIds, onClose, onSave, onDelete,
}: {
  lead: Lead;
  existingIds: Set<string>;
  onClose: () => void;
  onSave: (lead: Lead) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Lead>(lead);
  const isNew = !existingIds.has(lead.id);

  const update = <K extends keyof Lead>(key: K, value: Lead[K]) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-auto" onClick={onClose}>
      <div
        className="bg-panel border border-border rounded-2xl w-full max-w-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-semibold">{isNew ? "New lead" : draft.name || "Edit lead"}</h3>
          <button onClick={onClose} className="text-muted hover:text-text text-xl leading-none">×</button>
        </header>

        <div className="p-5 grid sm:grid-cols-2 gap-4">
          <Field label="Name" full>
            <input value={draft.name} onChange={(e) => update("name", e.target.value)} className={inputCls} />
          </Field>

          <Field label="Status">
            <select value={draft.status} onChange={(e) => update("status", e.target.value as LeadStatus)} className={inputCls}>
              {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="Source">
            <input value={draft.source} onChange={(e) => update("source", e.target.value)} className={inputCls} />
          </Field>

          <Field label="Deal value ($)">
            <input
              type="number"
              value={draft.value ?? ""}
              onChange={(e) => update("value", e.target.value === "" ? null : Number(e.target.value))}
              className={inputCls}
            />
          </Field>

          <Field label="Probability %">
            <input
              type="number"
              value={draft.probability == null ? "" : Math.round(draft.probability * 100)}
              onChange={(e) => update("probability", e.target.value === "" ? null : Math.max(0, Math.min(100, Number(e.target.value))) / 100)}
              className={inputCls}
            />
          </Field>

          <Field label="Contact name">
            <input value={draft.contactName} onChange={(e) => update("contactName", e.target.value)} className={inputCls} />
          </Field>

          <Field label="Email">
            <input type="email" value={draft.email} onChange={(e) => update("email", e.target.value)} className={inputCls} />
          </Field>

          <Field label="Phone">
            <input value={draft.phone} onChange={(e) => update("phone", e.target.value)} className={inputCls} />
          </Field>

          <Field label="Performance model">
            <input value={draft.performanceModel} onChange={(e) => update("performanceModel", e.target.value)} className={inputCls} placeholder="e.g. 7%" />
          </Field>

          <Field label="Services" full>
            <input
              value={draft.services.join(", ")}
              onChange={(e) => update("services", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              className={inputCls}
              placeholder="Creatives, Meta, TikTok"
            />
          </Field>

          <Field label="Next follow-up">
            <input type="date" value={draft.nextFollowUp ?? ""} onChange={(e) => update("nextFollowUp", e.target.value || null)} className={inputCls} />
          </Field>

          <Field label="Closed date">
            <input type="date" value={draft.closedAt ?? ""} onChange={(e) => update("closedAt", e.target.value || null)} className={inputCls} />
          </Field>

          <Field label="Notes" full>
            <textarea
              value={draft.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={4}
              className={`${inputCls} resize-y`}
            />
          </Field>
        </div>

        <footer className="flex items-center justify-between gap-2 p-5 border-t border-border">
          {!isNew ? (
            <button
              onClick={() => { if (confirm(`Delete "${draft.name}"?`)) onDelete(draft.id); }}
              className="text-sm px-3 py-1.5 rounded-md text-bad hover:bg-bad/10"
            >
              Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="text-sm px-3 py-1.5 rounded-md bg-panel2 border border-border hover:border-accent">Cancel</button>
            <button onClick={() => onSave(draft)} className="text-sm px-3 py-1.5 rounded-md bg-accent text-white hover:opacity-90">
              {isNew ? "Add lead" : "Save"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

const inputCls =
  "bg-panel2 border border-border rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:border-accent text-text placeholder:text-muted/50";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-xs uppercase tracking-wider text-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso;
}
