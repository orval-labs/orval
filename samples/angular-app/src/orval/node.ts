import { setupServer } from 'msw/node';
import type { RequestHandler } from 'msw';

import * as httpClientMocks from '../api/http-client/index.msw';
import * as httpClientCustomParamsMocks from '../api/http-client-custom-params/index.msw';
import * as httpResourceMocks from '../api/http-resource/index.msw';
import * as httpResourceZodMocks from '../api/http-resource-zod/index.msw';

const allMocks = {
  ...httpClientMocks,
  ...httpClientCustomParamsMocks,
  ...httpResourceMocks,
  ...httpResourceZodMocks,
};

const handlers = Object.entries(allMocks).flatMap(([, getMock]) =>
  (getMock as () => RequestHandler[])(),
);
const server = setupServer(...handlers);

export { server };
