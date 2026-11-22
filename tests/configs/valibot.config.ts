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

const formatTypeProject = (
  name: string,
  valibot?: ValibotOptions,
  mode?: OutputMode,
) => {
  const project = valibotProject(name, 'date-type', valibot, mode);
  return {
    ...project,
    output: {
      ...project.output,
      override: {
        ...project.output.override,
        formatType: {
          'date-time': {
            type: 'Dayjs',
            decode: 'dayjs',
            decodeImport: { name: 'dayjs', importPath: 'dayjs', default: true },
          },
        },
      },
    },
  };
};

const MODELS = '../generated/valibot/model-type-checks-models/model';
// A dot in the name of the models directory is not an extension.
const DOTTED_MODELS =
  '../generated/valibot/model-type-checks-options-models/model.gen';

interface ModelTypeChecksProjectOptions {
  mode?: OutputMode;
  valibot?: ValibotOptions;
  input?: string;
  models?: string;
  useBigInt?: boolean;
  useReadonlyArrays?: boolean;
  fileExtension?: string;
}

// The checks the option writes compile against the models of
// `model-type-checks-models`.
const modelTypeChecksProject = (
  name: string,
  {
    mode,
    valibot,
    input = 'valibot-model-type-checks',
    models = MODELS,
    useBigInt,
    useReadonlyArrays,
    fileExtension,
  }: ModelTypeChecksProjectOptions = {},
) => {
  const project = valibotProject(
    name,
    input,
    { generateReusableSchemas: true, ...valibot },
    mode,
  );
  return {
    ...project,
    output: {
      ...project.output,
      ...(fileExtension
        ? {
            fileExtension,
            target: `../generated/valibot/${name}/${name}${fileExtension}`,
          }
        : {}),
      override: {
        ...project.output.override,
        ...(useBigInt ? { useBigInt } : {}),
        ...(useReadonlyArrays ? { useReadonlyArrays } : {}),
        modelTypeChecks: { models },
      },
    },
  };
};

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
  'format-type': formatTypeProject('format-type'),
  'format-type-reusable-schemas': formatTypeProject(
    'format-type-reusable-schemas',
    { generateReusableSchemas: true },
  ),
  'format-type-reusable-schemas-tags-split': formatTypeProject(
    'format-type-reusable-schemas-tags-split',
    { generateReusableSchemas: true },
    'tags-split',
  ),
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
  // `regressions/valibot-model-types.ts` checks these against the models.
  'model-types': valibotProject('model-types', 'valibot-model-types', {
    generateReusableSchemas: true,
  }),
  'model-types-models': {
    output: {
      target: '../generated/valibot/model-types-models/endpoints.ts',
      schemas: '../generated/valibot/model-types-models/model',
      client: 'fetch' as const,
      clean: true,
      formatter: 'prettier' as const,
    },
    input: { target: '../specifications/valibot-model-types.yaml' },
  },
  'model-types-exact-optional': valibotProject(
    'model-types-exact-optional',
    'valibot-model-types',
    { generateReusableSchemas: true, exactOptional: true },
  ),
  'model-types-format-type': (() => {
    const project = valibotProject(
      'model-types-format-type',
      'valibot-model-types',
      { generateReusableSchemas: true },
    );
    return {
      ...project,
      output: {
        ...project.output,
        override: {
          ...project.output.override,
          formatType: {
            'date-time': {
              type: 'Dayjs',
              decode: 'dayjs',
              decodeImport: {
                name: 'dayjs',
                importPath: 'dayjs',
                default: true,
              },
            },
          },
        },
      },
    };
  })(),
  'model-type-checks': modelTypeChecksProject('model-type-checks'),
  'model-type-checks-models': {
    output: {
      target: '../generated/valibot/model-type-checks-models/endpoints.ts',
      schemas: MODELS,
      client: 'fetch' as const,
      clean: true,
      formatter: 'prettier' as const,
    },
    input: { target: '../specifications/valibot-model-type-checks.yaml' },
  },
  'model-type-checks-tags-split': modelTypeChecksProject(
    'model-type-checks-tags-split',
    { mode: 'tags-split' },
  ),
  // For a project with `exactOptionalPropertyTypes`.
  'model-type-checks-exact-optional': modelTypeChecksProject(
    'model-type-checks-exact-optional',
    { valibot: { exactOptional: true } },
  ),
  'model-type-checks-options': modelTypeChecksProject(
    'model-type-checks-options',
    {
      input: 'valibot-model-type-checks-options',
      models: DOTTED_MODELS,
      useBigInt: true,
      useReadonlyArrays: true,
    },
  ),
  // A file extension of several parts is not the extension of the models.
  'model-type-checks-gen-extension': modelTypeChecksProject(
    'model-type-checks-gen-extension',
    {
      input: 'valibot-model-type-checks-options',
      models: DOTTED_MODELS,
      useBigInt: true,
      useReadonlyArrays: true,
      fileExtension: '.gen.ts',
    },
  ),
  'model-type-checks-types-extension': modelTypeChecksProject(
    'model-type-checks-types-extension',
    {
      input: 'valibot-model-type-checks-options',
      models: DOTTED_MODELS,
      useBigInt: true,
      useReadonlyArrays: true,
      fileExtension: '.types.ts',
    },
  ),
  'model-type-checks-options-models': {
    output: {
      target:
        '../generated/valibot/model-type-checks-options-models/endpoints.ts',
      schemas: DOTTED_MODELS,
      client: 'fetch' as const,
      clean: true,
      formatter: 'prettier' as const,
      override: { useBigInt: true, useReadonlyArrays: true },
    },
    input: {
      target: '../specifications/valibot-model-type-checks-options.yaml',
    },
  },
  'recursive-file': (() => {
    const project = valibotProject('recursive-file', 'valibot-recursive-file', {
      generateReusableSchemas: true,
    });
    return {
      ...project,
      output: {
        ...project.output,
        override: { ...project.output.override, useDates: true },
      },
    };
  })(),
});
