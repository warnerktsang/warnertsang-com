import { randomUUID } from 'node:crypto';
import type {
  CandidateSlot,
  IntentEvent,
  ReservationCriteria,
  ReservationIntent,
} from './types.js';

const intents = new Map<string, ReservationIntent>();
const events: IntentEvent[] = [];

const nowIso = () => new Date().toISOString();

const pushEvent = (event: IntentEvent) => {
  events.push(event);
};

export const createIntent = (
  criteria: ReservationCriteria,
  candidateSlot: CandidateSlot,
  expiresInSeconds = 120,
) => {
  const id = randomUUID();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + expiresInSeconds * 1000);

  const intent: ReservationIntent = {
    id,
    criteria,
    candidateSlot,
    status: 'pending_approval',
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  intents.set(id, intent);
  pushEvent({
    intentId: id,
    timestamp: nowIso(),
    type: 'intent_created',
  });

  return intent;
};

export const listIntents = () => {
  return [...intents.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};

export const getIntent = (id: string) => intents.get(id);

export const getEventsForIntent = (id: string) => {
  return events.filter((event) => event.intentId === id);
};

export const approveIntent = (id: string) => {
  const intent = intents.get(id);
  if (!intent) return undefined;

  const updated: ReservationIntent = {
    ...intent,
    status: 'approved',
    approvedAt: nowIso(),
  };

  intents.set(id, updated);
  pushEvent({
    intentId: id,
    timestamp: nowIso(),
    type: 'intent_approved',
  });

  return updated;
};

export const markBookingStarted = (id: string) => {
  const intent = intents.get(id);
  if (!intent) return undefined;

  const updated: ReservationIntent = {
    ...intent,
    status: 'booking_in_progress',
  };

  intents.set(id, updated);
  pushEvent({
    intentId: id,
    timestamp: nowIso(),
    type: 'booking_started',
  });

  return updated;
};

export const markBooked = (id: string, confirmationCode: string) => {
  const intent = intents.get(id);
  if (!intent) return undefined;

  const updated: ReservationIntent = {
    ...intent,
    status: 'booked',
    bookedAt: nowIso(),
    confirmationCode,
  };

  intents.set(id, updated);
  pushEvent({
    intentId: id,
    timestamp: nowIso(),
    type: 'booking_succeeded',
    detail: confirmationCode,
  });

  return updated;
};

export const markFailed = (id: string, failureReason: string) => {
  const intent = intents.get(id);
  if (!intent) return undefined;

  const updated: ReservationIntent = {
    ...intent,
    status: 'failed',
    failureReason,
  };

  intents.set(id, updated);
  pushEvent({
    intentId: id,
    timestamp: nowIso(),
    type: 'booking_failed',
    detail: failureReason,
  });

  return updated;
};

export const expirePendingIntents = () => {
  const now = Date.now();

  for (const [id, intent] of intents.entries()) {
    if (intent.status !== 'pending_approval') continue;
    if (new Date(intent.expiresAt).getTime() > now) continue;

    intents.set(id, {
      ...intent,
      status: 'expired',
    });

    pushEvent({
      intentId: id,
      timestamp: nowIso(),
      type: 'intent_expired',
    });
  }
};
