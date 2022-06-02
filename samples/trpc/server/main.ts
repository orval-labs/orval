import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import fastify from 'fastify';
import { appRouter } from '../client/src/api/router';
import './mock';

const server = fastify({
  maxParamLength: 5000,
});

server.register(require('@fastify/cors'));

server.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: { router: appRouter },
});

(async () => {
  try {
    await server.listen({
      port: 5000,
    });
    console.log('listening on port', 5000);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
})();
