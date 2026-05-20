import {
  type ClientMockGeneratorBuilder,
  generateDependencyImports,
  type GenerateMockImports,
  type GeneratorDependency,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  type GlobalMockOptions,
} from '@orval/core';

import { generateMSW } from '../msw';

function getFakerDependencies(
  options?: GlobalMockOptions,
): GeneratorDependency[] {
  const locale = options?.locale;

  return [
    {
      exports: [{ name: 'faker', values: true }],
      dependency: locale
        ? `@faker-js/faker/locale/${locale}`
        : '@faker-js/faker',
    },
  ];
}

/**
 * Emits the import header for a faker-only mock file. Faker output never
 * imports from `msw`, so this only emits `import { faker } from '@faker-js/faker'`
 * (or the locale-scoped variant) plus any operation-specific imports.
 */
export const generateFakerImports: GenerateMockImports = ({
  implementation,
  imports,
  projectName,
  hasSchemaDir,
  isAllowSyntheticDefaultImports,
  options,
}) => {
  return generateDependencyImports(
    implementation,
    [...getFakerDependencies(options), ...imports],
    projectName,
    hasSchemaDir,
    isAllowSyntheticDefaultImports,
  );
};

/**
 * Generates the faker-only mock output for a single operation. This reuses
 * the response-factory portion of {@link generateMSW} and strips out the
 * handler and aggregator entries so callers can write a standalone
 * `<file>.faker.ts` with no `msw` dependency.
 */
export function generateFaker(
  generatorVerbOptions: GeneratorVerbOptions,
  generatorOptions: GeneratorOptions,
): ClientMockGeneratorBuilder {
  const result = generateMSW(generatorVerbOptions, generatorOptions);
  return {
    implementation: {
      function: result.implementation.function,
      handler: '',
      handlerName: '',
    },
    imports: result.imports,
  };
}
