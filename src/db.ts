import { PrismaClient } from '@prisma/client';

// A single shared client for the process. In tests we swap in a mock.
export const prisma = new PrismaClient({
  log: process.env.PRISMA_LOG === '1' ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

export type Db = PrismaClient;
