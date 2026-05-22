import {
  type ClientMockGeneratorBuilder,
  type ContextSpec,
  generateDependencyImports,
  type GenerateMockImports,
  type GeneratorDependency,
  type GeneratorImport,
  type GeneratorOptions,
  type GeneratorSchema,
  type GeneratorVerbOptions,
  type GlobalMockOptions,
  pascal,
} from '@orval/core';

import { generateMSW } from '../msw';
import { getMockScalar } from './getters';

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

export interface GenerateFakerForSchemasResult {
  implementation: string;
  imports: GeneratorImport[];
}

/**
 * Builds the contents of a consolidated faker mock file for every entry under
 * `components/schemas`. Each schema produces a `get<SchemaName>Mock(overrides)`
 * factory in the spirit of the existing per-operation `get<Op>ResponseMock`
 * helpers. Opt in via `mock.generators: [{ type: 'faker', schemas: true }]`.
 *
 * Returns the function bodies plus any `GeneratorImport` references the
 * factories need so the writer can hoist them into the file header.
 */
export function generateFakerForSchemas(
  schemas: GeneratorSchema[],
  context: ContextSpec,
  options: GlobalMockOptions,
): GenerateFakerForSchemasResult {
  const factories: string[] = [];
  const allImports: GeneratorImport[] = [];
  // Shared across schemas so we emit each helper (e.g. an `allOf`-discriminator
  // sub-factory) once even when several schemas reference the same union arm.
  const splitMockImplementations: string[] = [];

  const mockOptions = context.output.override.mock;

  for (const generatorSchema of schemas) {
    const { name, schema } = generatorSchema;
    if (!schema) continue;

    const factoryName = `get${pascal(name)}Mock`;
    const factoryImports: GeneratorImport[] = [];

    const result = getMockScalar({
      item: {
        ...(schema as Record<string, unknown>),
        name,
      } as Parameters<typeof getMockScalar>[0]['item'],
      imports: factoryImports,
      mockOptions,
      operationId: name,
      tags: [],
      context,
      existingReferencedProperties: [],
      splitMockImplementations,
      allowOverride: true,
      isRef: false,
    } as Parameters<typeof getMockScalar>[0]);

    allImports.push(...result.imports, ...factoryImports);

    // Match the behavior of operation-response factories: only declare the
    // `overrideResponse` parameter when the generated expression actually
    // references it (top-level object schemas). Array / scalar / enum
    // schemas don't splice an override, so we omit the parameter rather than
    // emit a `Partial<Pet[]>` signature TS can't satisfy.
    const typeName = pascal(name);
    const isOverridable = result.value.includes('overrideResponse');
    const param = isOverridable
      ? `overrideResponse: Partial<${typeName}> = {}`
      : '';
    const factory = `export const ${factoryName} = (${param}): ${typeName} => (${result.value});\n`;

    factories.push(factory);

    // Track the schema type itself as an import so writers can reference it
    // from the generated factory file.
    allImports.push({
      name: pascal(name),
      values: false,
    });
  }

  // De-duplicate imports by name+alias so the header doesn't list the same
  // schema twice when multiple factories reference it.
  const seen = new Set<string>();
  const uniqueImports = allImports.filter((imp) => {
    const key = `${imp.name}::${imp.alias ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Reference `options` so unused-parameter rules don't complain; future
  // schema-specific behavior (e.g. naming convention) will read from it.
  void options;

  // Helper factories from union/discriminator handling (`splitMockImplementations`)
  // are emitted before the public `get<Schema>Mock` factories so call sites
  // declared after them resolve cleanly without TS hoisting concerns.
  const implementation = [...splitMockImplementations, ...factories].join('\n');

  return {
    implementation,
    imports: uniqueImports,
  };
}
