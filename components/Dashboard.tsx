"use client";

import { useEffect, useRef, useState } from "react";
import { AppState } from "@/lib/types";
import { buildDefaultState } from "@/lib/defaults";
import { exportJSON, importJSON, loadState, saveState } from "@/lib/storage";
import OverviewTab from "./tabs/OverviewTab";
import RevenueTab from "./tabs/RevenueTab";
import SocialsTab from "./tabs/SocialsTab";
import EmailsTab from "./tabs/EmailsTab";
import LeadsTab from "./tabs/LeadsTab";

const TABS = ["Overview", "Revenue", "Leads", "Socials", "Emails"] as const;
type Tab = (typeof TABS)[number];

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function Dashboard() {
  const [state, setState] = useState<AppState>(() => buildDefaultState());
  const [tab, setTab] = useState<Tab>("Overview");
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from server on mount
  useEffect(() => {
    let cancelled = false;
    loadState()
      .then((s) => {
        if (cancelled) return;
        setState(s);
        setHydrated(true);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setLoadError(e.message);
        setHydrated(true);
      });
    return () => { cancelled = true; };
  }, []);

  // Debounced auto-save (waits 500ms after last edit, so rapid typing = 1 write)
  useEffect(() => {
    if (!hydrated || loadError) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(() => {
      saveState(state)
        .then(() => setSaveStatus("saved"))
        .catch(() => setSaveStatus("error"));
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, hydrated, loadError]);

  const handleImport = async (file: File) => {
    try {
      const next = await importJSON(file);
      setState(next);
    } catch {
      alert("Could not import file. Make sure it is a valid dashboard JSON export.");
    }
  };

  const handleReset = () => {
    if (confirm("Reset all data? This cannot be undone.")) {
      setState(buildDefaultState(state.year));
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 bg-bg/80 backdrop-blur border-b border-border">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent2" />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">DDU Business Dashboard</h1>
              <p className="text-xs text-muted">Year {state.year} · Fill in every Monday</p>
            </div>
          </div>

          <nav className="flex bg-panel border border-border rounded-xl p-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 text-sm rounded-lg transition ${
                  tab === t ? "bg-accent text-white" : "text-muted hover:text-text"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <SyncIndicator status={saveStatus} loadError={loadError} />
            <input
              type="number"
              value={state.year}
              onChange={(e) => setState({ ...state, year: Number(e.target.value) || state.year })}
              className="bg-panel border border-border rounded-md px-2 py-1 w-20 text-sm text-text"
            />
            <button
              onClick={() => exportJSON(state)}
              className="text-sm px-3 py-1.5 rounded-md bg-panel border border-border hover:border-accent transition"
              title="Download a JSON backup"
            >
              Export
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-sm px-3 py-1.5 rounded-md bg-panel border border-border hover:border-accent transition"
              title="Restore from a JSON backup"
            >
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={handleReset}
              className="text-sm px-3 py-1.5 rounded-md text-muted hover:text-bad transition"
              title="Wipe all entries"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {!hydrated ? (
          <div className="text-muted text-sm">Loading from cloud…</div>
        ) : loadError ? (
          <div className="bg-bad/10 border border-bad/40 rounded-2xl p-5 text-sm">
            <div className="font-semibold text-bad mb-1">Could not load your data</div>
            <div className="text-muted">{loadError}</div>
            <div className="text-muted mt-2">
              Check that <code className="text-text/80">UPSTASH_REDIS_REST_URL</code> and{" "}
              <code className="text-text/80">UPSTASH_REDIS_REST_TOKEN</code> are set in your Vercel project settings.
            </div>
          </div>
        ) : tab === "Overview" ? (
          <OverviewTab state={state} />
        ) : tab === "Revenue" ? (
          <RevenueTab state={state} setState={setState} />
        ) : tab === "Leads" ? (
          <LeadsTab state={state} setState={setState} />
        ) : tab === "Socials" ? (
          <SocialsTab state={state} setState={setState} />
        ) : (
          <EmailsTab state={state} setState={setState} />
        )}

        <footer className="mt-12 pt-6 border-t border-border text-xs text-muted flex justify-between">
          <span>Data syncs to Upstash Redis. Same data on every device. Export weekly for an extra backup.</span>
          <span>v2</span>
        </footer>
      </main>
    </div>
  );
}

function SyncIndicator({ status, loadError }: { status: SaveStatus; loadError: string | null }) {
  if (loadError) {
    return <span className="text-xs text-bad flex items-center gap-1.5"><Dot color="bg-bad" /> offline</span>;
  }
  if (status === "saving") {
    return <span className="text-xs text-muted flex items-center gap-1.5"><Dot color="bg-warn animate-pulse" /> saving…</span>;
  }
  if (status === "error") {
    return <span className="text-xs text-bad flex items-center gap-1.5"><Dot color="bg-bad" /> save failed</span>;
  }
  if (status === "saved") {
    return <span className="text-xs text-muted flex items-center gap-1.5"><Dot color="bg-good" /> saved</span>;
  }
  return null;
}

function Dot({ color }: { color: string }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}
