import type { ValibotOptions } from '@orval/core';
import { defineConfig } from 'orval';

// `tests` installs Valibot, and `build` typechecks this output against it.
const valibotProject = (
  name: string,
  input: string,
  valibot?: ValibotOptions,
) => ({
  output: {
    target: `../generated/valibot/${name}/${name}.ts`,
    client: 'valibot' as const,
    clean: true,
    formatter: 'prettier' as const,
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
});
