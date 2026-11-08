import type { OutputMode, ValibotOptions } from '@orval/core';
import { defineConfig } from 'orval';

// `tests` installs Valibot, and `build` typechecks this output against it.
const valibotProject = (
  name: string,
  input: string,
  valibot?: ValibotOptions,
  mode?: OutputMode,
) => ({
  output: {
    target: `../generated/valibot/${name}/${name}.ts`,
    client: 'valibot' as const,
    clean: true,
    formatter: 'prettier' as const,
    ...(mode ? { mode } : {}),
    ...(valibot ? { override: { valibot } } : {}),
  },
  input: { target: `../specifications/${input}.yaml` },
});

export default defineConfig({
  logLevel: 'error',
  petstore: valibotProject('petstore', 'petstore'),
  'all-of-one-of': valibotProject('all-of-one-of', 'all-of-one-of'),
  'all-of-open-and-nullable-members': valibotProject(
    'all-of-open-and-nullable-members',
    'all-of-open-and-nullable-members',
  ),
  'all-of-required-in-parent': valibotProject(
    'all-of-required-in-parent',
    'all-of-required-in-parent',
  ),
  circular: valibotProject('circular', 'circular'),
  defaults: valibotProject('defaults', 'zod-required-default-values'),
  'discriminator-oneof-allof': valibotProject(
    'discriminator-oneof-allof',
    'discriminator-oneof-allof',
  ),
  'pattern-and-format': valibotProject(
    'pattern-and-format',
    'pattern-and-format',
  ),
  tuples: valibotProject('tuples', 'typed-arrays-tuples-v3-1'),
  'form-data': valibotProject('form-data', 'form-data'),
  'nullable-binary-parts': valibotProject(
    'nullable-binary-parts',
    'nullable-binary-parts',
  ),
  'one-of-required': valibotProject('one-of-required', 'one-of-required'),
  'strict-exact-optional': valibotProject('strict-exact-optional', 'petstore', {
    strict: {
      param: true,
      query: true,
      header: true,
      body: true,
      response: true,
    },
    exactOptional: true,
  }),
  'format-type': {
    output: {
      target: '../generated/valibot/format-type/format-type.ts',
      client: 'valibot',
      clean: true,
      formatter: 'prettier',
      override: {
        formatType: {
          'date-time': {
            type: 'Dayjs',
            decode: 'dayjs',
            decodeImport: { name: 'dayjs', importPath: 'dayjs', default: true },
          },
        },
      },
    },
    input: { target: '../specifications/date-type.yaml' },
  },
  // Component schemas become shared constants; cycles read through `v.lazy`.
  'reusable-schemas': valibotProject('reusable-schemas', 'valibot-reusable', {
    generateReusableSchemas: true,
  }),
  'reusable-schemas-tags-split': valibotProject(
    'reusable-schemas-tags-split',
    'valibot-reusable',
    { generateReusableSchemas: true },
    'tags-split',
  ),
});
