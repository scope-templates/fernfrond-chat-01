// A tiny in-memory stand-in for the Prisma client covering only the calls the
// services make. It lets the service tests run without a live database.
import type { Db } from '../src/db';

type AnyRec = Record<string, any>;

function cuid(prefix: string, n: number) {
  return `${prefix}_${n.toString().padStart(6, '0')}`;
}

export function makeFakeDb() {
  const customers: AnyRec[] = [];
  const staff: AnyRec[] = [];
  const conversations: AnyRec[] = [];
  const messages: AnyRec[] = [];
  const articles: AnyRec[] = [];
  let seq = 0;

  function matchWhere(rec: AnyRec, where: AnyRec = {}): boolean {
    return Object.entries(where).every(([k, v]) => rec[k] === v);
  }

  function includeConversation(c: AnyRec, include: AnyRec = {}) {
    const out: AnyRec = { ...c };
    if (include.customer) out.customer = customers.find((x) => x.id === c.customerId) ?? null;
    if (include.assignee) out.assignee = staff.find((x) => x.id === c.assigneeId) ?? null;
    if (include.messages) {
      let msgs = messages.filter((m) => m.conversationId === c.id);
      const order = include.messages.orderBy?.createdAt;
      if (order === 'asc') msgs = msgs.sort((a, b) => a._seq - b._seq);
      out.messages = msgs;
    }
    return out;
  }

  const db = {
    customer: {
      async findUnique({ where }: AnyRec) {
        return customers.find((c) => matchWhere(c, where)) ?? null;
      },
      async create({ data }: AnyRec) {
        const rec = { id: cuid('cust', ++seq), createdAt: new Date(), ...data };
        customers.push(rec);
        return rec;
      },
    },
    staffMember: {
      async findUnique({ where }: AnyRec) {
        return staff.find((s) => matchWhere(s, where)) ?? null;
      },
      async create({ data }: AnyRec) {
        const rec = { id: cuid('staff', ++seq), active: true, ...data };
        staff.push(rec);
        return rec;
      },
    },
    conversation: {
      async findUnique({ where, include }: AnyRec) {
        const c = conversations.find((x) => matchWhere(x, where));
        if (!c) return null;
        return include ? includeConversation(c, include) : { ...c };
      },
      async findMany({ where = {}, include }: AnyRec) {
        let result = conversations.filter((c) => matchWhere(c, where));
        result = result.sort((a, b) => b._seq - a._seq);
        return result.map((c) => (include ? includeConversation(c, include) : { ...c }));
      },
      async create({ data, include }: AnyRec) {
        const now = new Date();
        const rec: AnyRec = {
          id: cuid('conv', ++seq),
          _seq: seq,
          subject: data.subject,
          status: data.status ?? 'OPEN',
          customerId: data.customerId,
          assigneeId: data.assigneeId ?? null,
          createdAt: now,
          updatedAt: now,
        };
        conversations.push(rec);
        if (data.messages?.create) {
          const list = Array.isArray(data.messages.create)
            ? data.messages.create
            : [data.messages.create];
          for (const m of list) {
            messages.push({
              id: cuid('msg', ++seq),
              _seq: seq,
              conversationId: rec.id,
              author: m.author,
              staffId: m.staffId ?? null,
              body: m.body,
              createdAt: new Date(),
            });
          }
        }
        return include ? includeConversation(rec, include) : { ...rec };
      },
      async update({ where, data }: AnyRec) {
        const c = conversations.find((x) => matchWhere(x, where));
        if (!c) throw new Error('not found');
        Object.assign(c, data, { updatedAt: new Date() });
        return { ...c };
      },
    },
    message: {
      async create({ data }: AnyRec) {
        const rec = {
          id: cuid('msg', ++seq),
          _seq: seq,
          conversationId: data.conversationId,
          author: data.author,
          staffId: data.staffId ?? null,
          body: data.body,
          createdAt: new Date(),
        };
        messages.push(rec);
        return rec;
      },
    },
    plantCareArticle: {
      async findUnique({ where }: AnyRec) {
        return articles.find((a) => matchWhere(a, where)) ?? null;
      },
      async findMany({ orderBy }: AnyRec = {}) {
        let result = [...articles];
        if (orderBy?.title === 'asc') {
          result = result.sort((a, b) => a.title.localeCompare(b.title));
        }
        return result;
      },
      async create({ data }: AnyRec) {
        const rec = { id: cuid('art', ++seq), createdAt: new Date(), tags: [], ...data };
        articles.push(rec);
        return rec;
      },
    },
  };

  return { db: db as unknown as Db, stores: { customers, staff, conversations, messages, articles } };
}
