[![npm version](https://badge.fury.io/js/orval.svg)](https://badge.fury.io/js/orval)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# @orval/valibot

Generates [Valibot](https://valibot.dev/) schemas from OpenAPI specifications.

## Install

```sh
npm install -D @orval/valibot
npm install valibot
```

`valibot` is a peer dependency (`>=1`). `@orval/valibot` does not bundle it.

## Usage

Set `client: 'valibot'` in your `orval.config`:

```ts
import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    input: { target: './petstore.yaml' },
    output: {
      client: 'valibot',
      target: './src/api/schemas',
      mode: 'single',
    },
  },
});
```

## Generated output

```ts
import * as v from 'valibot';

export const CreatePetsBody = v.object({
  id: v.pipe(v.number(), v.integer()),
  name: v.string(),
  tag: v.optional(v.string()),
});
```

See the [Valibot guide](https://orval.dev/docs/guides/valibot) for how OpenAPI keywords are mapped and what is not supported yet.

## Configuration

Options are read from `override.valibot.*`:

- `strict` - emit `v.strictObject` for the locations set to `true` (`param`, `query`, `header`, `body`, `response`)
- `generate` - choose which of those locations get a schema
- `exactOptional` - emit `v.exactOptional` for optional properties
