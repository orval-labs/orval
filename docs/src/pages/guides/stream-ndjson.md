---
id: stream-ndjson
title: Stream Newline Delimited JSON
---

## Introduction

Orval generates code that properly types responses streamed from NDJSON.
[NDJSON](https://en.wikipedia.org/wiki/JSON_streaming#Newline-delimited_JSON) is a technique to stream an array of JSON objects. This is mostly used when the data set is large.

## How to Use

Orval does not generate code for actually parsing the stream, but rather provides type safety. Use the code in the example below to see how reading streamed data can be achieved.
Proper type support is only supported when using the Fetch client as either a standalone client, or as an [httpClient](../reference/configuration/output#httpclient).

### Example

```ts
// orval.config.ts
import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    input: {
      target: './stream.yaml',
    },
    output: {
      client: 'fetch',
      target: 'src/endpoints.ts',
      schemas: 'src/model',
    },
  },
});
```

```yml
openapi: 3.1.0
info:
  version: 1.0.0
  title: Stream
paths:
  /stream:
    get:
      operationId: stream
      description: Stream results
      responses:
        '200':
          description: The stream result.
          content:
            application/x-ndjson:
              schema:
                $ref: '#/components/schemas/StreamEntry'
components:
  schemas:
    StreamEntry:
      type: object
      properties:
        foo:
          type: number
        bar:
          type: string
```

```ts
// Generated code
interface TypedResponse<T> extends Response {
  json(): Promise<T>;
}

/**
 * Stream results
 */
export type streamResponse200 = {
  stream: TypedResponse<StreamEntry>;
  status: 200;
};
export type streamResponseComposite = streamResponse200;

export type streamResponse = streamResponseComposite & {
  headers: Headers;
};

export const getStreamUrl = () => {
  return `/stream`;
};

export const stream = async (
  options?: RequestInit,
): Promise<streamResponse> => {
  const stream = await fetch(getStreamUrl(), {
    ...options,
    method: 'GET',
    headers: { Accept: 'application/x-ndjson', ...options?.headers },
  });

  return {
    status: stream.status,
    stream,
    headers: stream.headers,
  } as streamResponse;
};
```

```ts
// Calling code
export const readStream = <T extends object>(
  response: Response & { json(): Promise<T> },
  processLine: (value: T) => void | boolean,
  onError?: (response?: Response) => any,
): Promise<any> => {
  if (!response.ok && onError) {
    return onError(response);
  }
  if (!response.body) return Promise.resolve(() => {});

  const stream = response.body.getReader();
  const matcher = /\r?\n/;
  const decoder = new TextDecoder();
  let buffer = '';

  const loop: () => Promise<undefined> = () =>
    stream.read().then(({ done, value }) => {
      if (done) {
        if (buffer.length > 0) processLine(JSON.parse(buffer));
      } else {
        const chunk = decoder.decode(value, {
          stream: true,
        });
        buffer += chunk;

        const parts = buffer.split(matcher);
        buffer = parts.pop() ?? '';
        const validParts = parts.filter((p) => p);
        if (validParts.length !== 0) {
          for (const i of validParts) {
            const p = JSON.parse(i) as T;
            processLine(p);
          }
          return loop();
        }
      }
    });

  return loop();
};

export const getResult = async () => {
  const results: StreamEntry[] = [];

  const streamResponse = await stream();
  if (streamResponse.status !== 200) return results;

  // The promise is resolved when the stream is complete.
  await readStream(streamResponse.stream, (obj) => {
    // obj is typed as StreamEntry
    results.push(obj);
  });
  return results;
};
```
