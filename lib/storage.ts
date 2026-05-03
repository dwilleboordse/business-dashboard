"use client";

import { AppState } from "./types";
import { buildDefaultState } from "./defaults";

/**
 * Storage talks to /api/state which is backed by Upstash Redis.
 * No data is kept in localStorage anymore; everything is server-side so
 * it's available on every browser/device.
 */

export async function loadState(): Promise<AppState> {
  try {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? `Load failed (${res.status})`);
    }
    const data = await res.json();
    if (!data) return buildDefaultState();
    return mergeWithDefaults(data);
  } catch (e) {
    console.error("loadState failed:", e);
    throw e;
  }
}

export async function saveState(state: AppState): Promise<void> {
  const res = await fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `Save failed (${res.status})`);
  }
}

export function exportJSON(state: AppState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ddu-dashboard-${state.year}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importJSON(file: File): Promise<AppState> {
  const text = await file.text();
  const parsed = JSON.parse(text) as AppState;
  return mergeWithDefaults(parsed);
}

/** Fill any missing fields from defaults so old/partial saves don't break the app. */
function mergeWithDefaults(saved: Partial<AppState>): AppState {
  const def = buildDefaultState(saved.year ?? new Date().getFullYear());
  return {
    year: saved.year ?? def.year,
    socials: {
      channels: { ...def.socials.channels, ...(saved.socials?.channels ?? {}) },
      weeks: (saved.socials?.weeks?.length === 52
        ? saved.socials.weeks.map((w, i) => ({ ...def.socials.weeks[i], ...w }))
        : def.socials.weeks),
      targets: { ...def.socials.targets, ...(saved.socials?.targets ?? {}) },
    },
    finance: {
      monthly: { ...def.finance.monthly, ...(saved.finance?.monthly ?? {}) },
    },
    emails: {
      monthlySubscribers: { ...def.emails.monthlySubscribers, ...(saved.emails?.monthlySubscribers ?? {}) },
      emailsByMonth: { ...def.emails.emailsByMonth, ...(saved.emails?.emailsByMonth ?? {}) },
    },
    leadsState: {
      leads: saved.leadsState?.leads ?? def.leadsState.leads,
    },
  };
}
