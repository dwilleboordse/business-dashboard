import {
  AppState, CHANNELS, EmailEntry, MONTHS, Month, SOCIAL_METRICS, WeeklyValues,
} from "./types";

const emptyWeek = (): WeeklyValues => {
  const w: WeeklyValues = {};
  for (const m of SOCIAL_METRICS) w[m.id] = null;
  return w;
};

const monthlyEmptyNumber = (): Record<Month, number | null> =>
  Object.fromEntries(MONTHS.map((m) => [m, null])) as Record<Month, number | null>;

export const buildDefaultState = (year = new Date().getFullYear()): AppState => ({
  year,
  socials: {
    channels: {
      Instagram: true,
      Facebook: false,
      YouTube: true,
      TikTok: true,
      Twitter: true,
      LinkedIn: true,
      Pinterest: false,
    },
    weeks: Array.from({ length: 52 }, () => emptyWeek()),
    targets: Object.fromEntries(SOCIAL_METRICS.map((m) => [m.id, m.target])),
  },
  finance: {
    monthly: Object.fromEntries(
      MONTHS.map((m) => [m, { goal: 200000, actual: null, costs: null }]),
    ) as Record<Month, { goal: number; actual: number | null; costs: number | null }>,
  },
  emails: {
    monthlySubscribers: monthlyEmptyNumber(),
    emailsByMonth: Object.fromEntries(MONTHS.map((m) => [m, [] as EmailEntry[]])) as Record<Month, EmailEntry[]>,
  },
  leadsState: {
    leads: [],
  },
});

export { CHANNELS };
