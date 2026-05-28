export type IntentStatus =
  | 'pending_approval'
  | 'approved'
  | 'booking_in_progress'
  | 'booked'
  | 'failed'
  | 'expired';

export interface ReservationCriteria {
  restaurantId: string;
  restaurantName: string;
  date: string;
  partySize: number;
  earliestTime: string;
  latestTime: string;
}

export interface CandidateSlot {
  slotId: string;
  date: string;
  time: string;
  partySize: number;
  source: 'mock';
}

export interface ReservationIntent {
  id: string;
  criteria: ReservationCriteria;
  candidateSlot: CandidateSlot;
  status: IntentStatus;
  createdAt: string;
  expiresAt: string;
  approvedAt?: string;
  bookedAt?: string;
  confirmationCode?: string;
  failureReason?: string;
}

export interface IntentEvent {
  intentId: string;
  timestamp: string;
  type:
    | 'intent_created'
    | 'intent_approved'
    | 'booking_started'
    | 'booking_succeeded'
    | 'booking_failed'
    | 'intent_expired';
  detail?: string;
}
