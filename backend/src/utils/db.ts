import { PrismaClient } from '@prisma/client';

// Prevent multiple instances of Prisma Client in development (hot-reloading)
// and in serverless environments (cold starts creating new connections each time)
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
