import { createFactory } from 'hono/factory';
import { HealthCheckContext } from '../endpoints.context';


const factory = createFactory();


export const healthCheckHandlers = factory.createHandlers(
async (c: HealthCheckContext) => {

  },
);
