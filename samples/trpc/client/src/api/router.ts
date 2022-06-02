import { createRouter } from './context';
import { petstoreRouter } from './endpoints/petstore';

export const appRouter = createRouter().merge(petstoreRouter);

export type AppRouter = typeof appRouter;
