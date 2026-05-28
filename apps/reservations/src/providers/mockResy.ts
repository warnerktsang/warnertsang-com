import { randomUUID } from 'node:crypto';
import type { CandidateSlot, ReservationCriteria, ReservationIntent } from '../domain/types.js';

const EASY_RESTAURANTS = new Set(['rubirosa', 'gramercy-tavern', 'crown-shy', 'rezdora']);

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const fromMinutes = (minutes: number) => {
  const hrs = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const mins = (minutes % 60).toString().padStart(2, '0');
  return `${hrs}:${mins}`;
};

export class MockResyProvider {
  async searchAvailability(criteria: ReservationCriteria): Promise<CandidateSlot | null> {
    if (!EASY_RESTAURANTS.has(criteria.restaurantId)) {
      return null;
    }

    const earliest = toMinutes(criteria.earliestTime);
    const latest = toMinutes(criteria.latestTime);
    if (earliest > latest) {
      return null;
    }

    const chosen = earliest + 30 <= latest ? earliest + 30 : earliest;

    return {
      slotId: randomUUID(),
      date: criteria.date,
      time: fromMinutes(chosen),
      partySize: criteria.partySize,
      source: 'mock',
    };
  }

  async bookSlot(intent: ReservationIntent): Promise<{ confirmationCode: string }> {
    const code = `MOCK-${intent.id.slice(0, 8).toUpperCase()}`;
    return { confirmationCode: code };
  }
}
