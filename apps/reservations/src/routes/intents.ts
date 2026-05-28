import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  approveIntent,
  createIntent,
  getEventsForIntent,
  getIntent,
  listIntents,
  markBooked,
  markBookingStarted,
  markFailed,
} from '../domain/store.js';
import { MockResyProvider } from '../providers/mockResy.js';

const criteriaSchema = z.object({
  restaurantId: z.string().min(2),
  restaurantName: z.string().min(2),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partySize: z.number().int().min(1).max(12),
  earliestTime: z.string().regex(/^\d{2}:\d{2}$/),
  latestTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const createIntentSchema = z.object({
  criteria: criteriaSchema,
  expiresInSeconds: z.number().int().min(30).max(600).default(120).optional(),
});

export const registerIntentRoutes = async (app: FastifyInstance) => {
  const provider = new MockResyProvider();

  app.get('/api/intents', async () => {
    return { intents: listIntents() };
  });

  app.get('/api/intents/:id', async (request, reply) => {
    const params = z
      .object({
        id: z.string().uuid(),
      })
      .safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({ error: 'Invalid intent id.' });
    }

    const intent = getIntent(params.data.id);
    if (!intent) {
      return reply.code(404).send({ error: 'Intent not found.' });
    }

    return {
      intent,
      events: getEventsForIntent(intent.id),
    };
  });

  app.post('/api/intents/search-and-create', async (request, reply) => {
    const parsed = createIntentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Invalid request payload.',
        detail: parsed.error.flatten(),
      });
    }

    const { criteria, expiresInSeconds } = parsed.data;
    const candidateSlot = await provider.searchAvailability(criteria);

    if (!candidateSlot) {
      return reply.code(404).send({
        error: 'No availability found for requested criteria.',
      });
    }

    const intent = createIntent(criteria, candidateSlot, expiresInSeconds ?? 120);
    return reply.code(201).send({ intent });
  });

  app.post('/api/intents/:id/approve', async (request, reply) => {
    const params = z
      .object({
        id: z.string().uuid(),
      })
      .safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({ error: 'Invalid intent id.' });
    }

    const existingIntent = getIntent(params.data.id);
    if (!existingIntent) {
      return reply.code(404).send({ error: 'Intent not found.' });
    }

    if (existingIntent.status !== 'pending_approval') {
      return reply.code(409).send({
        error: `Intent cannot be approved from status '${existingIntent.status}'.`,
      });
    }

    if (new Date(existingIntent.expiresAt).getTime() < Date.now()) {
      return reply.code(409).send({
        error: 'Intent is expired.',
      });
    }

    approveIntent(existingIntent.id);
    markBookingStarted(existingIntent.id);

    try {
      const booking = await provider.bookSlot(existingIntent);
      const booked = markBooked(existingIntent.id, booking.confirmationCode);

      return {
        intent: booked,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown booking failure';
      const failed = markFailed(existingIntent.id, reason);

      return reply.code(500).send({
        error: 'Booking failed.',
        intent: failed,
      });
    }
  });
};
