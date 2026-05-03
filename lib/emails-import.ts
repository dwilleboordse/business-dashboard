import { EmailEntry, EmailsState, MONTHS, Month } from "./types";

/**
 * Import an ActiveCampaign "All Campaigns Performance Report" CSV and merge
 * the campaigns into the existing emailsByMonth structure.
 *
 * Dedupe key: ISO date + lowercased subject. Re-importing the same export will
 * overwrite matching entries; new campaigns are appended.
 */
export async function importACCampaignsFromFile(
  file: File,
  existing: EmailsState,
): Promise<EmailsState> {
  const text = await file.text();
  const incoming = parseACCsv(text);
  return mergeCampaignsIntoState(existing, incoming);
}

/* ------------------------------- CSV parser ------------------------------- */

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        cur.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else field += c;
    }
  }
  if (field.length || cur.length) {
    cur.push(field);
    rows.push(cur);
  }
  return rows;
}

const num = (s: string | undefined): number | null => {
  if (!s) return null;
  const n = Number(s.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
};

/** Parse the AC export — skips report-metadata rows and finds the campaign table. */
export function parseACCsv(text: string): EmailEntry[] {
  const rows = parseCsv(text.replace(/^﻿/, ""));

  // Find the row whose first cell is "Campaign Name" — that's the data header.
  const headerIdx = rows.findIndex((r) => r[0]?.trim() === "Campaign Name");
  if (headerIdx === -1) return [];

  const headers = rows[headerIdx];
  const idx = (label: string) => headers.findIndex((h) => h.trim().toLowerCase() === label.toLowerCase());
  const subjectI = idx("Subject");
  const sentI = idx("Sent Date");
  const openI = idx("Open Rate");
  const clickI = idx("Click Rate");
  const unsubsI = idx("Unsubscribes");
  const nameI = idx("Campaign Name");

  const out: EmailEntry[] = [];
  for (const row of rows.slice(headerIdx + 1)) {
    if (!row.length || !row[0]?.trim()) continue;

    const subject = (row[subjectI] ?? "").trim() || (row[nameI] ?? "").trim();
    if (!subject) continue;

    // Sent date format: "2026-04-29 18:37:59" — take date portion.
    const sentRaw = (row[sentI] ?? "").trim();
    const date = sentRaw.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const openPctRaw = num(row[openI]);
    const clickPctRaw = num(row[clickI]);

    out.push({
      date,
      name: subject,
      // AC reports rates as percentage numbers ("54.76" = 54.76%). Store as 0..1 to match the dashboard.
      openPct: openPctRaw == null ? null : openPctRaw / 100,
      clickPct: clickPctRaw == null ? null : clickPctRaw / 100,
      unsubs: num(row[unsubsI]),
      revenue: null,
      link: "",
    });
  }
  return out;
}

/* ------------------------------ Merge logic ------------------------------ */

function bucketKey(entry: EmailEntry): string {
  return `${entry.date}|${entry.name.trim().toLowerCase()}`;
}

function monthForDate(iso: string): Month | null {
  const m = Number(iso.slice(5, 7));
  if (!Number.isFinite(m) || m < 1 || m > 12) return null;
  return MONTHS[m - 1];
}

export function mergeCampaignsIntoState(existing: EmailsState, incoming: EmailEntry[]): EmailsState {
  // Build a map of every existing email keyed by date|name, regardless of which month bucket it lives in.
  type Located = { month: Month; entry: EmailEntry };
  const byKey = new Map<string, Located>();
  const cleaned: Record<Month, EmailEntry[]> = Object.fromEntries(
    MONTHS.map((m) => [m, [] as EmailEntry[]]),
  ) as Record<Month, EmailEntry[]>;

  for (const m of MONTHS) {
    for (const entry of existing.emailsByMonth[m] ?? []) {
      byKey.set(bucketKey(entry), { month: m, entry });
      cleaned[m].push(entry);
    }
  }

  for (const newEntry of incoming) {
    const month = monthForDate(newEntry.date);
    if (!month) continue;

    const key = bucketKey(newEntry);
    const found = byKey.get(key);

    if (found) {
      // Update in place. Preserve any locally-edited revenue/link the user added in the dashboard.
      const merged: EmailEntry = {
        ...found.entry,
        ...newEntry,
        revenue: found.entry.revenue ?? newEntry.revenue,
        link: found.entry.link || newEntry.link || "",
      };
      const list = cleaned[found.month];
      const idx = list.findIndex((e) => bucketKey(e) === key);
      if (idx !== -1) list[idx] = merged;
      byKey.set(key, { month: found.month, entry: merged });
    } else {
      cleaned[month].push(newEntry);
      byKey.set(key, { month, entry: newEntry });
    }
  }

  // Sort each month newest-first so the table stays tidy after re-imports.
  for (const m of MONTHS) {
    cleaned[m].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }

  return { ...existing, emailsByMonth: cleaned };
}
