import { setupWorker } from 'msw/browser';

import { getSwaggerPetstoreMock } from '../api/endpoints/petstoreFromFileSpecWithTransformer.msw';

const handlers = getSwaggerPetstoreMock();
console.log('MSW handlers:', handlers);

export const worker = setupWorker(...handlers);

// Log when MSW starts
worker.events.on('request:start', ({ request }) => {
  console.log('🔵 MSW intercepted:', request.method, request.url);
});

worker.events.on('request:match', ({ request }) => {
  console.log('✅ MSW matched:', request.method, request.url);
});

worker.events.on('request:unhandled', ({ request }) => {
  console.log('⚠️ MSW unhandled:', request.method, request.url);
});

worker.events.on('response:mocked', ({ request, response }) => {
  console.log(
    '📤 MSW mocked response:',
    request.method,
    request.url,
    response.status,
  );
});
