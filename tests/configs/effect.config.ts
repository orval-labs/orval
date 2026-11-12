import type { EffectOptions, OutputMode } from '@orval/core';
import { defineConfig } from 'orval';

const reusableProject = (
  name: string,
  effect: EffectOptions,
  mode?: OutputMode,
) => ({
  output: {
    target: `../generated/effect/${name}/${name}.ts`,
    client: 'effect' as const,
    clean: true,
    formatter: 'prettier' as const,
    ...(mode ? { mode } : {}),
    override: { effect: { generateReusableSchemas: true, ...effect } },
  },
  input: { target: '../specifications/valibot-reusable.yaml' },
});

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
  formatType: {
    output: {
      target: '../generated/effect/format-type/format-type.ts',
      client: 'effect',
      override: {
        formatType: {
          'date-time': {
            type: 'Dayjs',
            effect: {
              schema: 'DayjsFromString',
              schemaImport: {
                name: 'DayjsFromString',
                importPath: '../../../mutators/effect-dayjs',
              },
            },
            encode: '(value) => value.toISOString()',
          },
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/date-type.yaml',
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
  'all-of-open-and-nullable-members': {
    output: {
      target:
        '../generated/effect/all-of-open-and-nullable-members/all-of-open-and-nullable-members.ts',
      client: 'effect',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/all-of-open-and-nullable-members.yaml',
    },
  },
  'all-of-required-in-parent': {
    output: {
      target:
        '../generated/effect/all-of-required-in-parent/all-of-required-in-parent.ts',
      client: 'effect',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/all-of-required-in-parent.yaml',
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
  // Component schemas become shared constants; cycles read through `S.suspend`.
  'reusable-schemas': reusableProject('reusable-schemas', {}),
  'reusable-schemas-tags-split': reusableProject(
    'reusable-schemas-tags-split',
    {},
    'tags-split',
  ),
  'reusable-schemas-exact-optional': reusableProject(
    'reusable-schemas-exact-optional',
    { exactOptional: true },
  ),
  'format-type-reusable-schemas': {
    output: {
      target:
        '../generated/effect/format-type-reusable-schemas/format-type-reusable-schemas.ts',
      client: 'effect',
      override: {
        effect: { generateReusableSchemas: true },
        formatType: {
          'date-time': {
            type: 'Dayjs',
            effect: {
              schema: 'DayjsFromString',
              schemaImport: {
                name: 'DayjsFromString',
                importPath: '../../../mutators/effect-dayjs',
              },
            },
            encode: '(value) => value.toISOString()',
          },
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/date-type.yaml',
    },
  },
});
