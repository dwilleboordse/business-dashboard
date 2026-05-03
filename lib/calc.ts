import { SOCIAL_METRICS, SocialMetric, SocialsState, WeeklyValues } from "./types";

export const num = (v: number | null | undefined): number => (typeof v === "number" && !Number.isNaN(v) ? v : 0);

export const safeDiv = (n: number, d: number): number => (d === 0 ? 0 : n / d);

export function metricTotal(metric: SocialMetric, weeks: WeeklyValues[]): number {
  if (metric.total === "computed" && metric.computeFrom) {
    const num1 = weeks.reduce((s, w) => s + num(w[metric.computeFrom!.numerator]), 0);
    const den = weeks.reduce((s, w) => s + num(w[metric.computeFrom!.denominator]), 0);
    return safeDiv(num1, den);
  }

  const values = weeks.map((w) => w[metric.id]).filter((v): v is number => typeof v === "number");
  if (!values.length) return 0;

  if (metric.total === "max") return Math.max(...values);
  if (metric.total === "avg") return values.reduce((s, v) => s + v, 0) / values.length;
  return values.reduce((s, v) => s + v, 0); // sum
}

export function progressPct(metric: SocialMetric, weeks: WeeklyValues[], targets: Record<string, number>): number {
  const target = targets[metric.id] ?? metric.target;
  if (!target) return 0;
  return metricTotal(metric, weeks) / target;
}

export function statusFromProgress(pct: number): "good" | "warn" | "bad" {
  if (pct >= 0.66) return "good";
  if (pct >= 0.33) return "warn";
  return "bad";
}

export function metricsByGroup() {
  const groups: Record<string, SocialMetric[]> = {};
  for (const m of SOCIAL_METRICS) {
    (groups[m.group] ||= []).push(m);
  }
  return groups;
}

/** Build a {label, value} array of weekly values for a single metric, used by charts. */
export function weeklySeries(metric: SocialMetric, weeks: WeeklyValues[]) {
  return weeks.map((w, i) => {
    let v: number | null = null;
    if (metric.total === "computed" && metric.computeFrom) {
      const n = w[metric.computeFrom.numerator];
      const d = w[metric.computeFrom.denominator];
      v = typeof n === "number" && typeof d === "number" && d !== 0 ? n / d : null;
    } else {
      const raw = w[metric.id];
      v = typeof raw === "number" ? raw : null;
    }
    return { week: `W${i + 1}`, value: v };
  });
}

/** Aggregate weekly entries to a 12-month rollup using the metric's `total` rule. */
export function monthlyRollup(metric: SocialMetric, weeks: WeeklyValues[], year: number) {
  // map week index to the month it ends in (rough — a week ~ 7 days starting from Jan 1)
  const buckets: number[][] = Array.from({ length: 12 }, () => []);
  const start = new Date(Date.UTC(year, 0, 1));
  for (let i = 0; i < weeks.length; i++) {
    const d = new Date(start.getTime() + i * 7 * 86400000);
    const month = d.getUTCMonth();
    if (month < 12) {
      const w = weeks[i];
      const v =
        metric.total === "computed" && metric.computeFrom
          ? null
          : typeof w[metric.id] === "number" ? (w[metric.id] as number) : null;
      if (v !== null) buckets[month].push(v);
    }
  }

  return buckets.map((vals) => {
    if (!vals.length) return null;
    if (metric.total === "max") return Math.max(...vals);
    if (metric.total === "avg") return vals.reduce((s, v) => s + v, 0) / vals.length;
    return vals.reduce((s, v) => s + v, 0);
  });
}

export function fmt(value: number, unit?: "number" | "currency" | "percent"): string {
  if (!Number.isFinite(value)) return "—";
  if (unit === "currency") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  }
  if (unit === "percent") {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (Math.abs(value) >= 10000) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

export function activeMetrics(socials: SocialsState): SocialMetric[] {
  const channels = socials.channels;
  return SOCIAL_METRICS.filter((m) => {
    if (m.id.startsWith("ig_")) return channels.Instagram;
    if (m.id.startsWith("li_")) return channels.LinkedIn;
    if (m.id.startsWith("tw_")) return channels.Twitter;
    if (m.id.startsWith("yt_")) return channels.YouTube;
    return true;
  });
}
