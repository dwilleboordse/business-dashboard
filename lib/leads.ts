import { Lead, LEAD_STATUSES, LeadStatus, OPEN_STATUSES } from "./types";

export function newLead(partial: Partial<Lead> = {}): Lead {
  const now = new Date().toISOString().slice(0, 10);
  return {
    id: partial.id ?? `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    status: "Check in later",
    value: null,
    probability: null,
    source: "",
    contactName: "",
    email: "",
    phone: "",
    performanceModel: "",
    services: [],
    createdAt: now,
    updatedAt: now,
    nextFollowUp: null,
    closedAt: null,
    notes: "",
    ...partial,
  };
}

/** Sanitize anything that came from the importer or a malformed save. */
export function normalizeLead(raw: Partial<Lead> & { id?: string; name?: string }): Lead {
  const base = newLead();
  const status: LeadStatus = (LEAD_STATUSES as readonly string[]).includes(raw.status as string)
    ? (raw.status as LeadStatus)
    : "Check in later";
  return {
    ...base,
    ...raw,
    id: raw.id || base.id,
    name: raw.name || "(unnamed)",
    status,
    value: typeof raw.value === "number" ? raw.value : null,
    probability: typeof raw.probability === "number" ? raw.probability : null,
    source: raw.source ?? "",
    contactName: raw.contactName ?? "",
    email: raw.email ?? "",
    phone: raw.phone ?? "",
    performanceModel: raw.performanceModel ?? "",
    services: Array.isArray(raw.services) ? raw.services : [],
    createdAt: raw.createdAt ?? base.createdAt,
    updatedAt: raw.updatedAt ?? base.createdAt,
    nextFollowUp: raw.nextFollowUp ?? null,
    closedAt: raw.closedAt ?? null,
    notes: raw.notes ?? "",
  };
}

export async function importLeadsFromFile(file: File, existing: Lead[]): Promise<Lead[]> {
  const text = await file.text();
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "json") {
    const parsed = JSON.parse(text);
    const incoming: Lead[] = Array.isArray(parsed)
      ? parsed.map(normalizeLead)
      : Array.isArray(parsed.leads)
        ? parsed.leads.map(normalizeLead)
        : [];
    return mergeLeadsById(existing, incoming);
  }

  if (ext === "csv") {
    const incoming = parseClickupCsv(text).map(normalizeLead);
    return mergeLeadsById(existing, incoming);
  }

  throw new Error(`Unsupported file extension: ${ext}`);
}

/** Existing leads keep their data unless the import has a record with the same id; in that case the import wins. */
export function mergeLeadsById(existing: Lead[], incoming: Lead[]): Lead[] {
  const map = new Map(existing.map((l) => [l.id, l]));
  for (const lead of incoming) map.set(lead.id, lead);
  return [...map.values()];
}

/** Pipeline value of all open leads. */
export function openPipelineValue(leads: Lead[]): number {
  return leads.filter((l) => OPEN_STATUSES.includes(l.status)).reduce((s, l) => s + (l.value ?? 0), 0);
}

/** Probability-weighted pipeline value. */
export function weightedPipelineValue(leads: Lead[]): number {
  return leads
    .filter((l) => OPEN_STATUSES.includes(l.status))
    .reduce((s, l) => s + (l.value ?? 0) * (l.probability ?? 0), 0);
}

export function wonValue(leads: Lead[]): number {
  return leads.filter((l) => l.status === "Won").reduce((s, l) => s + (l.value ?? 0), 0);
}

export function winRate(leads: Lead[]): number {
  const decided = leads.filter((l) => l.status === "Won" || l.status === "Lost");
  if (!decided.length) return 0;
  const won = decided.filter((l) => l.status === "Won").length;
  return won / decided.length;
}

export function isOverdue(dateISO: string | null): boolean {
  if (!dateISO) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateISO + "T00:00:00");
  return d.getTime() < today.getTime();
}

/* --------------------------- Inline CSV parser --------------------------- */
/* Handles ClickUp's CSV format (quoted commas, double-double quotes, etc.). */

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  out.push(cur);
  return out;
}

/** Parse multi-line CSV correctly (newlines inside quoted fields). */
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
  return rows.filter((r) => r.length > 1 || (r[0] && r[0].length));
}

const STATUS_MAP: Record<string, LeadStatus> = {
  closed: "Won",
  lost: "Lost",
  "check in later": "Check in later",
  "proposal sent": "Proposal sent",
  negotiating: "Negotiating",
};

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function parseClickupDate(s: string | undefined): string | null {
  if (!s) return null;
  const cleaned = s.replace(/(\d+)(st|nd|rd|th)\b/gi, "$1");
  const m = cleaned.match(/(?:[A-Za-z]+,\s*)?([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return null;
  const day = Number(m[2]);
  const year = Number(m[3]);
  if (!day || !year) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseLabels(s: string | undefined): string[] {
  if (!s) return [];
  let stripped = s.trim();
  if (stripped.startsWith("[") && stripped.endsWith("]")) stripped = stripped.slice(1, -1);
  return stripped.split(",").map((x) => x.trim()).filter(Boolean);
}

function parseProbability(s: string | undefined): number | null {
  if (!s) return null;
  const cleaned = s.trim().replace(/%$/, "").trim();
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n > 1 ? n / 100 : n;
}

function parseClickupCsv(text: string): Partial<Lead>[] {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  if (!rows.length) return [];
  const headers = rows[0];

  // Resolve duplicate headers: pick first non-empty column for each header per row.
  const headerIndices = new Map<string, number[]>();
  headers.forEach((h, i) => {
    const arr = headerIndices.get(h) ?? [];
    arr.push(i);
    headerIndices.set(h, arr);
  });
  const get = (row: string[], header: string): string => {
    for (const i of headerIndices.get(header) ?? []) {
      const v = row[i];
      if (v && v.trim()) return v;
    }
    return "";
  };

  return rows.slice(1).flatMap((row) => {
    const name = get(row, "Task Name").trim();
    if (!name) return [];
    const rawStatus = get(row, "Status").trim().toLowerCase();
    const status = STATUS_MAP[rawStatus] ?? "Check in later";
    const latestComment = get(row, "Latest Comment").trim();
    const taskContent = get(row, "Task Content").trim();
    const notes = [latestComment, taskContent === "\\n" ? "" : taskContent].filter(Boolean).join("\n\n");
    const valueStr = get(row, "Deal Value (currency)").replace(/,/g, "").trim();
    const value = valueStr ? Number(valueStr) : null;
    return [{
      id: get(row, "Task ID") || name,
      name,
      status,
      value: Number.isFinite(value as number) ? value : null,
      probability: parseProbability(get(row, "Probability % (number)")),
      source: get(row, "Deal Source (drop down)").trim(),
      contactName: get(row, "Contact Name (short text)").trim(),
      email: get(row, "Email (email)").trim(),
      phone: get(row, "Phone (phone)").trim(),
      performanceModel: get(row, "Performance model (short text)").trim(),
      services: parseLabels(get(row, "Service/Product (labels)")),
      createdAt: parseClickupDate(get(row, "Date Created")),
      updatedAt: parseClickupDate(get(row, "Date Updated")),
      nextFollowUp: parseClickupDate(get(row, "Due Date")),
      closedAt: parseClickupDate(get(row, "Date Done")) ?? parseClickupDate(get(row, "Date Closed")),
      notes,
    }];
  });
}
