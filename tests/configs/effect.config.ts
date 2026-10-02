import { defineConfig } from 'orval';

// `tests` installs Effect 4, and `build` typechecks this output against it.
export default defineConfig({
  logLevel: 'error',
  petstore: {
    output: {
      target: '../generated/effect/petstore/petstore.ts',
      client: 'effect',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  'all-of-one-of': {
    output: {
      target: '../generated/effect/all-of-one-of/all-of-one-of.ts',
      client: 'effect',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/all-of-one-of.yaml',
    },
  },
  defaults: {
    output: {
      target: '../generated/effect/defaults/defaults.ts',
      client: 'effect',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/zod-required-default-values.yaml',
    },
  },
  'pattern-and-format': {
    output: {
      target: '../generated/effect/pattern-and-format/pattern-and-format.ts',
      client: 'effect',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/pattern-and-format.yaml',
    },
  },
  tuples: {
    output: {
      target: '../generated/effect/tuples/tuples.ts',
      client: 'effect',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/typed-arrays-tuples-v3-1.yaml',
    },
  },
  'form-data': {
    output: {
      target: '../generated/effect/form-data/form-data.ts',
      client: 'effect',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/form-data.yaml',
    },
  },
});
