import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationService } from '../src/conversationService';
import { CareLibrary } from '../src/careLibrary';
import { makeFakeDb } from './fakeDb';
import { drainOutbox } from '../src/notifications';
import { ConflictError, NotFoundError } from '../src/errors';

describe('ConversationService', () => {
  let db: ReturnType<typeof makeFakeDb>['db'];
  let stores: ReturnType<typeof makeFakeDb>['stores'];
  let svc: ConversationService;

  beforeEach(async () => {
    const made = makeFakeDb();
    db = made.db;
    stores = made.stores;
    svc = new ConversationService(db);
    drainOutbox();
    await db.customer.create({ data: { id: 'c1', email: 'a@b.com', name: 'Ann' } } as any);
    await db.staffMember.create({ data: { id: 's1', email: 's@b.com', name: 'Sam' } } as any);
  });

  it('opens a conversation with a first message and notifies support', async () => {
    const convo = await svc.openConversation({
      customerId: 'c1',
      subject: 'Droopy pothos',
      firstMessage: 'My pothos is drooping badly.',
    });
    expect(convo.status).toBe('OPEN');
    expect((convo as any).messages).toHaveLength(1);
    const out = drainOutbox();
    expect(out).toHaveLength(1);
    expect(out[0].to).toBe('support@fernandfrond.example');
  });

  it('rejects opening for an unknown customer', async () => {
    await expect(
      svc.openConversation({ customerId: 'ghost', subject: 'x', firstMessage: 'y' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('flips status to WAITING_ON_CUSTOMER after a staff reply', async () => {
    const convo = await svc.openConversation({
      customerId: 'c1',
      subject: 'Fern tips brown',
      firstMessage: 'Help my fern',
    });
    await svc.postMessage({
      conversationId: convo.id,
      author: 'STAFF',
      staffId: 's1',
      body: 'Try more humidity.',
    });
    const updated = stores.conversations.find((c) => c.id === convo.id);
    expect(updated!.status).toBe('WAITING_ON_CUSTOMER');
  });

  it('reopens when the customer replies to a waiting conversation', async () => {
    const convo = await svc.openConversation({
      customerId: 'c1',
      subject: 'Cactus rot',
      firstMessage: 'Base is soft',
    });
    await svc.postMessage({ conversationId: convo.id, author: 'STAFF', staffId: 's1', body: 'Stop watering.' });
    await svc.postMessage({ conversationId: convo.id, author: 'CUSTOMER', body: 'Ok, done.' });
    const updated = stores.conversations.find((c) => c.id === convo.id);
    expect(updated!.status).toBe('OPEN');
  });

  it('requires a staffId for staff messages', async () => {
    const convo = await svc.openConversation({
      customerId: 'c1',
      subject: 's',
      firstMessage: 'm',
    });
    await expect(
      svc.postMessage({ conversationId: convo.id, author: 'STAFF', body: 'no id' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('blocks posting to an archived conversation', async () => {
    const convo = await svc.openConversation({ customerId: 'c1', subject: 's', firstMessage: 'm' });
    await svc.transition(convo.id, 'ARCHIVED');
    await expect(
      svc.postMessage({ conversationId: convo.id, author: 'CUSTOMER', body: 'still here?' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects an illegal status transition', async () => {
    const convo = await svc.openConversation({ customerId: 'c1', subject: 's', firstMessage: 'm' });
    await svc.transition(convo.id, 'ARCHIVED');
    await expect(svc.transition(convo.id, 'OPEN')).rejects.toBeInstanceOf(ConflictError);
  });

  it('only assigns active staff', async () => {
    const convo = await svc.openConversation({ customerId: 'c1', subject: 's', firstMessage: 'm' });
    const assigned = await svc.assign(convo.id, 's1');
    expect(assigned.assigneeId).toBe('s1');
  });
});

describe('CareLibrary', () => {
  it('searches across title, species and tags', async () => {
    const { db } = makeFakeDb();
    await db.plantCareArticle.create({
      data: {
        slug: 'a',
        title: 'Overwatered monstera',
        species: 'Monstera deliciosa',
        body: '...',
        tags: ['watering'],
      },
    } as any);
    const lib = new CareLibrary(db);
    expect((await lib.search('monstera')).length).toBe(1);
    expect((await lib.search('watering')).length).toBe(1);
    expect((await lib.search('orchid')).length).toBe(0);
    expect((await lib.search('  ')).length).toBe(0);
  });
});
