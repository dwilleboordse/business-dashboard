export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;
export type Month = (typeof MONTHS)[number];

export const CHANNELS = [
  "Instagram", "Facebook", "YouTube", "TikTok", "Twitter", "LinkedIn", "Pinterest",
] as const;
export type Channel = (typeof CHANNELS)[number];

export type Direction = "sum" | "max";

export type SocialMetric = {
  id: string;
  group: "Engagement" | "Leads" | "Clients" | "Fans";
  label: string;
  /** how the yearly total is computed from the 52 weekly entries */
  total: Direction | "avg" | "computed";
  /** computed metrics derive from other ids; not entered directly */
  computeFrom?: { numerator: string; denominator: string };
  target: number;
  unit?: "number" | "currency" | "percent";
};

export const SOCIAL_METRICS: SocialMetric[] = [
  // Engagement
  { id: "ig_followers", group: "Engagement", label: "Followers Instagram", total: "max", target: 10000 },
  { id: "ig_impressions", group: "Engagement", label: "Impressions Instagram", total: "sum", target: 1_000_000 },
  { id: "ig_posts", group: "Engagement", label: "Posts Instagram", total: "sum", target: 250 },
  { id: "li_followers", group: "Engagement", label: "Followers LinkedIn", total: "max", target: 20000 },
  { id: "li_impressions", group: "Engagement", label: "Impressions LinkedIn", total: "sum", target: 1_000_000 },
  { id: "li_posts", group: "Engagement", label: "Posts LinkedIn", total: "sum", target: 172 },
  { id: "tw_growth", group: "Engagement", label: "Follower growth Twitter", total: "sum", target: 10000 },
  { id: "tw_impressions", group: "Engagement", label: "Impressions Twitter", total: "sum", target: 2_000_000 },
  { id: "tw_posts", group: "Engagement", label: "Posts Twitter", total: "sum", target: 500 },
  { id: "yt_subs", group: "Engagement", label: "Subscribers YouTube", total: "max", target: 2000 },
  { id: "yt_views", group: "Engagement", label: "Views YouTube", total: "sum", target: 25000 },
  { id: "yt_posts", group: "Engagement", label: "Posts YouTube", total: "sum", target: 16 },

  // Leads
  { id: "ad_spend", group: "Leads", label: "Ad Spend", total: "sum", target: 200000, unit: "currency" },
  { id: "calls_total", group: "Leads", label: "Calls booked total", total: "sum", target: 160 },
  { id: "calls_ads", group: "Leads", label: "Calls booked from ads", total: "sum", target: 53 },
  {
    id: "cpc_ads", group: "Leads", label: "Cost per call (ads)",
    total: "computed", target: 250, unit: "currency",
    computeFrom: { numerator: "ad_spend", denominator: "calls_ads" },
  },

  // Clients
  { id: "calls_done", group: "Clients", label: "Calls done", total: "sum", target: 150 },
  { id: "proposals_sent", group: "Clients", label: "Proposals sent", total: "sum", target: 150 },
  { id: "proposals_value_sent", group: "Clients", label: "Value of proposals sent", total: "sum", target: 500000, unit: "currency" },
  { id: "proposals_accepted", group: "Clients", label: "Proposals accepted", total: "sum", target: 50 },
  {
    id: "close_ratio", group: "Clients", label: "Close ratio",
    total: "computed", target: 0.5, unit: "percent",
    computeFrom: { numerator: "proposals_accepted", denominator: "proposals_sent" },
  },
  { id: "proposals_value_accepted", group: "Clients", label: "Value proposals accepted", total: "sum", target: 250000, unit: "currency" },

  // Fans
  { id: "reviews", group: "Fans", label: "Reviews", total: "sum", target: 20 },
  { id: "referrals", group: "Fans", label: "Referrals", total: "sum", target: 28 },
  { id: "total_clients", group: "Fans", label: "Total clients", total: "sum", target: 50 },
  { id: "clients_left", group: "Fans", label: "Clients left", total: "sum", target: 5 },
  { id: "retention", group: "Fans", label: "Retention", total: "avg", target: 0.9, unit: "percent" },
];

export type WeeklyValues = Record<string, number | null>;

export type SocialsState = {
  channels: Record<Channel, boolean>;
  /** index 0 = Week 1 ... index 51 = Week 52 */
  weeks: WeeklyValues[];
  targets: Record<string, number>;
};

export type FinanceMonth = {
  goal: number;
  actual: number | null;
  costs: number | null;
};

export type FinanceState = {
  monthly: Record<Month, FinanceMonth>;
};

export type EmailEntry = {
  date: string;       // ISO yyyy-mm-dd
  name: string;
  openPct: number | null;
  clickPct: number | null;
  unsubs: number | null;
  revenue: number | null;
  link?: string;
};

export type EmailsState = {
  monthlySubscribers: Record<Month, number | null>;
  emailsByMonth: Record<Month, EmailEntry[]>;
};

export const LEAD_STATUSES = [
  "Check in later",
  "Proposal sent",
  "Negotiating",
  "Won",
  "Lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Statuses that count as still-open pipeline (i.e. not Won/Lost). */
export const OPEN_STATUSES: LeadStatus[] = ["Check in later", "Proposal sent", "Negotiating"];

export type Lead = {
  id: string;
  name: string;
  status: LeadStatus;
  value: number | null;
  /** 0..1 */
  probability: number | null;
  source: string;
  contactName: string;
  email: string;
  phone: string;
  performanceModel: string;
  services: string[];
  /** ISO yyyy-mm-dd */
  createdAt: string | null;
  updatedAt: string | null;
  nextFollowUp: string | null;
  closedAt: string | null;
  notes: string;
};

export type LeadsState = {
  leads: Lead[];
};

export type AppState = {
  year: number;
  socials: SocialsState;
  finance: FinanceState;
  emails: EmailsState;
  leadsState: LeadsState;
};
