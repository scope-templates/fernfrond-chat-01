import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rose = await prisma.staffMember.upsert({
    where: { email: 'rose@fernandfrond.example' },
    update: {},
    create: { email: 'rose@fernandfrond.example', name: 'Rose Okafor' },
  });

  await prisma.staffMember.upsert({
    where: { email: 'dev@fernandfrond.example' },
    update: {},
    create: { email: 'dev@fernandfrond.example', name: 'Devon Marsh' },
  });

  const customer = await prisma.customer.upsert({
    where: { email: 'harriet@example.com' },
    update: {},
    create: { email: 'harriet@example.com', name: 'Harriet Vale' },
  });

  await prisma.plantCareArticle.upsert({
    where: { slug: 'monstera-yellow-leaves' },
    update: {},
    create: {
      slug: 'monstera-yellow-leaves',
      title: 'Why are my monstera leaves turning yellow?',
      species: 'Monstera deliciosa',
      body: 'Yellowing usually means overwatering. Let the top two inches of soil dry out before watering again.',
      tags: ['monstera', 'watering', 'yellowing'],
    },
  });

  await prisma.plantCareArticle.upsert({
    where: { slug: 'fern-humidity' },
    update: {},
    create: {
      slug: 'fern-humidity',
      title: 'Keeping ferns from crisping up',
      species: 'Nephrolepis exaltata',
      body: 'Ferns want humidity above 50%. Group plants together or use a pebble tray.',
      tags: ['fern', 'humidity', 'browning'],
    },
  });

  const convo = await prisma.conversation.create({
    data: {
      subject: 'My fern is going brown at the tips',
      customerId: customer.id,
      assigneeId: rose.id,
      status: 'WAITING_ON_CUSTOMER',
      messages: {
        create: [
          { author: 'CUSTOMER', body: 'The tips of my Boston fern keep browning. Help!' },
          { author: 'STAFF', staffId: rose.id, body: 'Sounds like low humidity. How often do you mist it?' },
        ],
      },
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded conversation ${convo.id}`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
