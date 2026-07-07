import "server-only";
import { env } from "@/lib/env";
import { tokenStore } from "@/connectors/token-store";

export const GOOGLE_PROVIDER = "google";
export const CALENDAR_READONLY_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

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
 * Fails closed: throws a user-facing message if the account isn't connected or
 * the read-only calendar scope was not granted.
 */
export async function getGoogleAccessToken(userId: string): Promise<string> {
  const token = await tokenStore.get(userId, GOOGLE_PROVIDER);
  if (!token || !token.accessToken) {
    throw new Error(
      "Google account is not connected. Sign in with Google to grant calendar access.",
    );
  }
  if (token.scope && !token.scope.includes(CALENDAR_READONLY_SCOPE)) {
    throw new Error(
      "Read-only calendar permission was not granted. Reconnect Google and allow calendar access.",
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
