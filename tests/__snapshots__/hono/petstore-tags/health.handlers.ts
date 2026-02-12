import { createFactory } from 'hono/factory';
import { HealthCheckContext } from './health.context';

const factory = createFactory();
export const healthCheckHandlers = factory.createHandlers(
  async (c: HealthCheckContext) => {},
);
