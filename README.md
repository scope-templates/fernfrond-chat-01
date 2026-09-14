# Fern & Frond Support

Backend for the customer support chat used by the Fern & Frond plant nursery. Customers
ask plant-care questions; staff answer them. Conversations and their messages are stored
durably in Postgres through Prisma.

## Stack

- Node.js + TypeScript
- Express for the HTTP API
- Prisma ORM against Postgres
- Zod for request validation
- Vitest for the service tests (run against an in-memory fake of the Prisma client)

## Getting started

```bash
npm install            # runs prisma generate
cp .env.example .env   # point DATABASE_URL at your Postgres
npm run migrate        # create the tables
npx ts-node prisma/seed.ts
npm run dev
```

## API

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/api/conversations` | Open a conversation with a first customer message |
| GET  | `/api/conversations` | List conversations, filter by `status` / `assigneeId` |
| GET  | `/api/conversations/:id` | Full thread with messages |
| POST | `/api/conversations/:id/messages` | Append a message |
| POST | `/api/conversations/:id/assign` | Assign to a staff member |
| POST | `/api/conversations/:id/status` | Move through the status workflow |
| GET  | `/api/care/search?q=` | Search the plant-care library |
| GET  | `/api/care/:slug` | Read a care article |

## Status workflow

```
OPEN <-> WAITING_ON_CUSTOMER
  |            |
  +--> RESOLVED <--+
  |            |
  +--> ARCHIVED (terminal)
```

Staff replies move a conversation to `WAITING_ON_CUSTOMER`; a customer reply moves it
back to `OPEN`. Archived conversations are read-only.

## Known gaps

Today the whole flow is request/response and synchronous. Long-running staff
assist work (drafting a suggested reply, looking things up across the care library,
waiting for a supervisor to approve a reply before it is sent) is done by hand.
Replies are delivered through the local `src/notifications.ts` stub, and there is no
streaming of partial answers back to the customer, no persistence of any in-progress
assist run, and no way to pause a reply for human approval before it goes out.

## The history

`prisma/seed-data.json` holds six months of the support chat (March to August 2026): six hundred and twenty
customers, twenty care articles, five staff accounts and a thousand conversations with their messages.
`npx ts-node prisma/seed.ts` loads it into an empty database and leaves a database that already has
conversations alone.

One of the five staff accounts is **Fern & Frond Assistant**. Since March the assistant answers every new
chat first, from the care library, and a person steps in when the customer asks for one or when the
assistant cannot help; that hand-over is a `SYSTEM` message ("Handed to Rose Okafor") and a change of
assignee. Customers on the monthly plant box write in here too, about skipping, pausing and stopping it.
