/* eslint-disable @typescript-eslint/no-var-requires */
// Require the framework and instantiate it
import { faker } from '@faker-js/faker';
import fastify from 'fastify';
import orval from 'orval';

const app = fastify();

app.register(require('fastify-cors'));

app.register(require('fastify-swagger'), {
  routePrefix: '/documentation',
  openapi: {
    info: {
      title: 'Petstore API',
      description: 'Petstore API',
      version: '1.0.0',
    },
    externalDocs: {
      url: 'https://swagger.io',
      description: 'Find more info here',
    },
    security: [],
  },
  uiConfig: {
    docExpansion: 'full',
    deepLinking: false,
  },
  exposeRoute: true,
});

app.ready(async () => {
  await orval(
    {
      output: {
        target: './endpoints',
        schemas: './schemas',
        client: 'react-query',
        clean: true,
        override: {
          mutator: {
            path: './mutator/custom-instance.ts',
            name: 'customInstance',
          },
        },
      },
      input: { target: app.swagger() },
    },
    './apps/app/src/api'
  );

  if (process.env.UPDATE_SPEC) {
    app.close();
    process.exit(0);
  }

  console.log('ready port 3000');
});

export const getGetPetsMock = () =>
  [...Array(faker.number.int({ min: 1, max: 10 }))].map(() => ({
    id: faker.number.int(),
    name: faker.word.sample(),
    tag: faker.word.sample(),
  }));

app.get(
  '/pets',
  {
    schema: {
      response: {
        201: {
          description: 'Successful response',
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'name', 'tag'],
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
              tag: { type: 'string' },
            },
          },
        },
      },
    },
  },
  async () => {
    return getGetPetsMock();
  }
);

// Run the server!
const start = async () => {
  try {
    await app.listen(3000);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};
start();
