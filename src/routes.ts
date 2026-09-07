import { Router } from 'express';
import { z } from 'zod';
import type { Db } from './db';
import { ConversationService } from './conversationService';
import { CareLibrary } from './careLibrary';
import { DomainError } from './errors';

const openSchema = z.object({
  customerId: z.string().min(1),
  subject: z.string().min(1).max(200),
  firstMessage: z.string().min(1).max(4000),
});

const messageSchema = z.object({
  author: z.enum(['CUSTOMER', 'STAFF', 'SYSTEM']),
  body: z.string().min(1).max(4000),
  staffId: z.string().optional(),
});

const statusSchema = z.object({
  to: z.enum(['OPEN', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'ARCHIVED']),
});

const assignSchema = z.object({ staffId: z.string().min(1) });

export function buildRouter(db: Db): Router {
  const router = Router();
  const conversations = new ConversationService(db);
  const library = new CareLibrary(db);

  router.post('/conversations', async (req, res, next) => {
    try {
      const input = openSchema.parse(req.body);
      const created = await conversations.openConversation(input);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  router.get('/conversations', async (req, res, next) => {
    try {
      const status = req.query.status as any;
      const assigneeId = req.query.assigneeId as string | undefined;
      const list = await conversations.list({ status, assigneeId });
      res.json(list);
    } catch (err) {
      next(err);
    }
  });

  router.get('/conversations/:id', async (req, res, next) => {
    try {
      const thread = await conversations.thread(req.params.id);
      res.json(thread);
    } catch (err) {
      next(err);
    }
  });

  router.post('/conversations/:id/messages', async (req, res, next) => {
    try {
      const parsed = messageSchema.parse(req.body);
      const message = await conversations.postMessage({
        conversationId: req.params.id,
        ...parsed,
      });
      res.status(201).json(message);
    } catch (err) {
      next(err);
    }
  });

  router.post('/conversations/:id/assign', async (req, res, next) => {
    try {
      const { staffId } = assignSchema.parse(req.body);
      const updated = await conversations.assign(req.params.id, staffId);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  router.post('/conversations/:id/status', async (req, res, next) => {
    try {
      const { to } = statusSchema.parse(req.body);
      const updated = await conversations.transition(req.params.id, to);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  router.get('/care/search', async (req, res, next) => {
    try {
      const q = (req.query.q as string) ?? '';
      res.json(await library.search(q));
    } catch (err) {
      next(err);
    }
  });

  router.get('/care/:slug', async (req, res, next) => {
    try {
      res.json(await library.getBySlug(req.params.slug));
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function errorHandler(
  err: unknown,
  _req: any,
  res: any,
  _next: any,
): void {
  if (err instanceof DomainError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  if (err && typeof err === 'object' && 'issues' in (err as any)) {
    res.status(422).json({ error: 'VALIDATION', issues: (err as any).issues });
    return;
  }
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'INTERNAL', message: 'Unexpected error' });
}
