import "server-only";
import { env } from "@/lib/env";
import { tokenStore } from "@/connectors/token-store";

export const GOOGLE_PROVIDER = "google";
export const CALENDAR_READONLY_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";
export const GMAIL_READONLY_SCOPE =
  "https://www.googleapis.com/auth/gmail.readonly";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

interface RefreshResponse {
  access_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
}

async function refreshGoogleToken(refreshToken: string): Promise<RefreshResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Failed to refresh Google access token (${res.status}). Please sign in again.`,
    );
  }
  return (await res.json()) as RefreshResponse;
}

/**
 * Returns a valid Google access token for the user, refreshing if expired.
 * Fails closed: throws a user-facing message if the account isn't connected.
 * Scope validation is handled per-connector via ConnectorRegistry.
 */
export async function getGoogleAccessToken(userId: string): Promise<string> {
  const token = await tokenStore.get(userId, GOOGLE_PROVIDER);
  if (!token || !token.accessToken) {
    throw new Error(
      "Google account is not connected. Sign in with Google to grant access.",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const stillValid = token.expiresAt != null && token.expiresAt - 60 > now;
  if (stillValid) return token.accessToken;

  if (!token.refreshToken) {
    if (token.expiresAt == null || token.expiresAt > now) return token.accessToken;
    throw new Error(
      "Google session expired and cannot be refreshed. Please sign in again.",
    );
  }

  const refreshed = await refreshGoogleToken(token.refreshToken);
  await tokenStore.save(userId, GOOGLE_PROVIDER, {
    ...token,
    accessToken: refreshed.access_token,
    expiresAt: now + refreshed.expires_in,
    tokenType: refreshed.token_type ?? token.tokenType,
    scope: refreshed.scope ?? token.scope,
  });
  return refreshed.access_token;
}

export interface CalendarEvent {
  title: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
  location?: string;
  description?: string;
}

interface GoogleEventDateTime {
  dateTime?: string;
  date?: string;
}

interface GoogleEvent {
  summary?: string;
  location?: string;
  description?: string;
  status?: string;
  start?: GoogleEventDateTime;
  end?: GoogleEventDateTime;
}

interface GoogleEventsResponse {
  items?: GoogleEvent[];
}

// ---------------------------------------------------------------------------
// Gmail API
// ---------------------------------------------------------------------------

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string | null;
  from: string | null;
  to: string | null;
  date: string | null;
  snippet: string;
  body: string | null;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

interface GmailPayload {
  headers?: GmailHeader[];
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

interface GmailMessageRaw {
  id: string;
  threadId: string;
  snippet?: string;
  payload?: GmailPayload;
}

interface GmailListResponse {
  messages?: { id: string; threadId: string }[];
  resultSizeEstimate?: number;
}

function header(payload: GmailPayload | undefined, name: string): string | null {
  return (
    payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())
      ?.value ?? null
  );
}

const BODY_MAX_CHARS = 8_000;

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = Buffer.from(base64, "base64").toString("utf-8");
  return decoded.length > BODY_MAX_CHARS
    ? decoded.slice(0, BODY_MAX_CHARS) + "\n[truncated]"
    : decoded;
}

function extractBody(part: GmailPart | GmailPayload | undefined): string | null {
  if (!part) return null;
  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  if (part.parts) {
    for (const sub of part.parts) {
      const found = extractBody(sub);
      if (found) return found;
    }
  }
  return null;
}

export interface SearchMessagesParams {
  accessToken: string;
  query: string;
  maxResults?: number;
}

/**
 * Searches Gmail messages using a Gmail search query string (e.g. "from:alice
 * subject:invoice after:2026/01/01"). Returns lightweight message metadata
 * with a snippet; use getGmailMessage for full body. Read-only.
 */
export async function searchGmailMessages(
  params: SearchMessagesParams,
): Promise<GmailMessage[]> {
  const { accessToken, query, maxResults = 20 } = params;

  const listUrl = new URL(`${GMAIL_API}/users/me/messages`);
  listUrl.searchParams.set("q", query);
  listUrl.searchParams.set("maxResults", String(maxResults));

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) {
    if (listRes.status === 401 || listRes.status === 403) {
      throw new Error(
        "Google denied the Gmail request (permission or session issue). Try signing in again.",
      );
    }
    throw new Error(`Gmail API error (${listRes.status}).`);
  }

  const listData = (await listRes.json()) as GmailListResponse;
  const ids = listData.messages ?? [];
  if (ids.length === 0) return [];

  const results = await Promise.allSettled(
    ids.map((m) => getGmailMessage({ accessToken, id: m.id })),
  );
  return results
    .filter(
      (r): r is PromiseFulfilledResult<GmailMessage> =>
        r.status === "fulfilled" && r.value !== null,
    )
    .map((r) => r.value);
}

export interface GetMessageParams {
  accessToken: string;
  id: string;
}

/**
 * Fetches a single Gmail message by ID including its decoded plain-text body.
 * Read-only.
 */
export async function getGmailMessage(
  params: GetMessageParams,
): Promise<GmailMessage | null> {
  const { accessToken, id } = params;

  const url = new URL(`${GMAIL_API}/users/me/messages/${encodeURIComponent(id)}`);
  url.searchParams.set("format", "full");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Google denied the Gmail request (permission or session issue). Try signing in again.",
      );
    }
    throw new Error(`Gmail API error fetching message ${id} (${res.status}).`);
  }

  const raw = (await res.json()) as GmailMessageRaw;
  return {
    id: raw.id,
    threadId: raw.threadId,
    subject: header(raw.payload, "subject"),
    from: header(raw.payload, "from"),
    to: header(raw.payload, "to"),
    date: header(raw.payload, "date"),
    snippet: raw.snippet ?? "",
    body: extractBody(raw.payload) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Calendar API
// ---------------------------------------------------------------------------

export interface ListEventsParams {
  accessToken: string;
  timeMin: string;
  timeMax: string;
  calendarId?: string;
  maxResults?: number;
}

/**
 * Reads events from the Google Calendar API (read-only). No write endpoints are
 * ever called. Fails closed on non-2xx responses.
 */
export async function listCalendarEvents(
  params: ListEventsParams,
): Promise<CalendarEvent[]> {
  const {
    accessToken,
    timeMin,
    timeMax,
    calendarId = "primary",
    maxResults = 50,
  } = params;

  const url = new URL(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
  );
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", String(maxResults));

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Google denied the calendar request (permission or session issue). Try signing in again.",
      );
    }
    throw new Error(`Google Calendar API error (${res.status}).`);
  }

  const data = (await res.json()) as GoogleEventsResponse;
  const items = data.items ?? [];
  return items
    .filter((e) => e.status !== "cancelled")
    .map((e) => {
      const allDay = Boolean(e.start?.date && !e.start?.dateTime);
      return {
        title: e.summary?.trim() || "(no title)",
        start: e.start?.dateTime ?? e.start?.date ?? null,
        end: e.end?.dateTime ?? e.end?.date ?? null,
        allDay,
        ...(e.location ? { location: e.location } : {}),
        ...(e.description ? { description: e.description } : {}),
      } satisfies CalendarEvent;
    });
}
