import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import type { AppState, Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATE_KEY = "dashboard:state";
const MAX_EVENTS_PER_SYNC = 100;

type CalendarLeadInput = {
  calendarEventId?: unknown;
  company?: unknown;
  contactName?: unknown;
  email?: unknown;
  phone?: unknown;
  source?: unknown;
  services?: unknown;
  callStart?: unknown;
  notes?: unknown;
};

type ValidCalendarLead = {
  calendarEventId: string;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  source: string;
  services: string[];
  callStart: string;
  notes: string;
};

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validateEvent(input: CalendarLeadInput): ValidCalendarLead | null {
  const calendarEventId = cleanString(input.calendarEventId, 256);
  const company = cleanString(input.company, 240);
  const contactName = cleanString(input.contactName, 240);
  const email = cleanString(input.email, 320).toLowerCase();
  const callStart = cleanString(input.callStart, 64);

  if (!calendarEventId || !email || !email.includes("@") || !callStart) return null;

  const parsedCallStart = new Date(callStart);
  if (Number.isNaN(parsedCallStart.getTime())) return null;

  return {
    calendarEventId,
    company,
    contactName,
    email,
    phone: cleanString(input.phone, 80),
    source: cleanString(input.source, 160),
    services: Array.isArray(input.services)
      ? input.services.map((service) => cleanString(service, 120)).filter(Boolean).slice(0, 20)
      : [],
    callStart,
    notes: cleanString(input.notes, 8_000),
  };
}

function dateInDubai(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function calendarLeadId(eventId: string): string {
  return `gcal_${eventId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function appendCalendarMetadata(event: ValidCalendarLead): string {
  const details = [
    event.notes,
    `Call booked: ${event.callStart}`,
    `Google Calendar event ID: ${event.calendarEventId}`,
  ].filter(Boolean);
  return details.join("\n\n");
}

function newCalendarLead(event: ValidCalendarLead, today: string): Lead {
  return {
    id: calendarLeadId(event.calendarEventId),
    name: event.company || event.contactName || event.email,
    status: "Call Booked",
    value: null,
    probability: null,
    source: event.source,
    contactName: event.contactName,
    email: event.email,
    phone: event.phone,
    performanceModel: "",
    services: event.services,
    createdAt: today,
    updatedAt: today,
    nextFollowUp: event.callStart.slice(0, 10),
    closedAt: null,
    notes: appendCalendarMetadata(event),
  };
}

function updateExistingLead(lead: Lead, event: ValidCalendarLead, today: string): Lead {
  const canMoveToCallBooked = lead.status === "Check in later";
  const eventMarker = `Google Calendar event ID: ${event.calendarEventId}`;
  const notes = lead.notes.includes(eventMarker)
    ? lead.notes
    : [lead.notes, appendCalendarMetadata(event)].filter(Boolean).join("\n\n");

  return {
    ...lead,
    status: canMoveToCallBooked ? "Call Booked" : lead.status,
    name: lead.name || event.company || event.contactName || event.email,
    source: lead.source || event.source,
    contactName: lead.contactName || event.contactName,
    email: lead.email || event.email,
    phone: lead.phone || event.phone,
    services: lead.services.length ? lead.services : event.services,
    nextFollowUp: canMoveToCallBooked ? event.callStart.slice(0, 10) : lead.nextFollowUp,
    updatedAt: today,
    notes,
  };
}

export async function POST(req: Request) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return NextResponse.json({ error: "Storage not configured." }, { status: 503 });
  }

  const origin = req.headers.get("origin");
  const requestUrl = new URL(req.url);
  if (origin && new URL(origin).host !== requestUrl.host) {
    return NextResponse.json({ error: "Cross-origin calendar sync is not allowed." }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as { events?: unknown } | null;
  if (!body || !Array.isArray(body.events)) {
    return NextResponse.json({ error: "Expected an events array." }, { status: 400 });
  }
  if (body.events.length > MAX_EVENTS_PER_SYNC) {
    return NextResponse.json({ error: `A sync can include at most ${MAX_EVENTS_PER_SYNC} events.` }, { status: 400 });
  }

  const validEvents = body.events
    .map((event) => validateEvent(event as CalendarLeadInput))
    .filter((event): event is ValidCalendarLead => event !== null);

  const redis = Redis.fromEnv();
  const state = await redis.get<AppState>(STATE_KEY);
  if (!state?.leadsState?.leads) {
    return NextResponse.json({ error: "Dashboard state is missing or invalid." }, { status: 409 });
  }

  const today = dateInDubai();
  const leads = state.leadsState.leads.slice();
  const indexById = new Map(leads.map((lead, index) => [lead.id, index]));
  const indexByEmail = new Map(
    leads
      .map((lead, index) => [lead.email.trim().toLowerCase(), index] as const)
      .filter(([email]) => Boolean(email)),
  );

  let added = 0;
  let updated = 0;
  let skipped = body.events.length - validEvents.length;

  for (const event of validEvents) {
    const id = calendarLeadId(event.calendarEventId);
    const existingIndex = indexById.get(id) ?? indexByEmail.get(event.email);

    if (existingIndex === undefined) {
      const lead = newCalendarLead(event, today);
      indexById.set(lead.id, leads.length);
      indexByEmail.set(lead.email, leads.length);
      leads.push(lead);
      added += 1;
      continue;
    }

    const existing = leads[existingIndex];
    const alreadyLinked = existing.notes.includes(`Google Calendar event ID: ${event.calendarEventId}`);
    const shouldAdvanceStatus = existing.status === "Check in later";
    if (alreadyLinked && !shouldAdvanceStatus) {
      skipped += 1;
      continue;
    }

    leads[existingIndex] = updateExistingLead(existing, event, today);
    indexById.set(id, existingIndex);
    updated += 1;
  }

  if (added || updated) {
    await redis.set(STATE_KEY, {
      ...state,
      leadsState: { ...state.leadsState, leads },
    });
  }

  return NextResponse.json({
    ok: true,
    received: body.events.length,
    valid: validEvents.length,
    added,
    updated,
    skipped,
  });
}
