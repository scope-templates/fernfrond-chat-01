import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

type Seed = {
  staff: { email: string; name: string }[];
  customers: { email: string; name: string; createdAt: string }[];
  articles: { slug: string; title: string; species: string; body: string; tags: string[] }[];
  conversations: {
    subject: string;
    customerEmail: string;
    assigneeEmail: string | null;
    status: 'OPEN' | 'WAITING_ON_CUSTOMER' | 'RESOLVED' | 'ARCHIVED';
    createdAt: string;
    messages: { author: 'CUSTOMER' | 'STAFF' | 'SYSTEM'; staffEmail: string | null; body: string; createdAt: string }[];
  }[];
};

async function main() {
  const seed: Seed = JSON.parse(readFileSync(join(__dirname, 'seed-data.json'), 'utf8'));

  const staffId = new Map<string, string>();
  for (const s of seed.staff) {
    const row = await prisma.staffMember.upsert({ where: { email: s.email }, update: {}, create: s });
    staffId.set(s.email, row.id);
  }
  const customerId = new Map<string, string>();
  for (const c of seed.customers) {
    const row = await prisma.customer.upsert({
      where: { email: c.email },
      update: {},
      create: { email: c.email, name: c.name, createdAt: new Date(c.createdAt) },
    });
    customerId.set(c.email, row.id);
  }
  for (const a of seed.articles) {
    await prisma.plantCareArticle.upsert({ where: { slug: a.slug }, update: {}, create: a });
  }

  const existing = await prisma.conversation.count();
  if (existing > 0) {
    // eslint-disable-next-line no-console
    console.log(`Conversations already present (${existing}); not loading the history again.`);
    return;
  }
  let loaded = 0;
  for (const c of seed.conversations) {
    await prisma.conversation.create({
      data: {
        subject: c.subject,
        status: c.status,
        customerId: customerId.get(c.customerEmail)!,
        assigneeId: c.assigneeEmail ? staffId.get(c.assigneeEmail) ?? null : null,
        createdAt: new Date(c.createdAt),
        messages: {
          create: c.messages.map((m) => ({
            author: m.author,
            staffId: m.staffEmail ? staffId.get(m.staffEmail) ?? null : null,
            body: m.body,
            createdAt: new Date(m.createdAt),
          })),
        },
      },
    });
    loaded += 1;
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${loaded} conversations`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
