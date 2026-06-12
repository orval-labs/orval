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
  type StrictMockSchemaKind,
} from '@orval/core';

import {
  formatMockFactoryDeclaration,
  classifyStrictMockSchemaType,
  collectStrictMockSchemaTypeNamesFromImplementation,
  getMockFactorySignatureParts,
  getStrictMockTypeName,
  isStrictMock,
  mergeStrictMockSchemaKinds,
} from '../mock-types';
import { generateMSW } from '../msw';
import { getMockWithoutFunc } from '../msw/mocks';
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
    strictMockSchemaTypeNames: result.strictMockSchemaTypeNames,
    strictMockSchemaKinds: result.strictMockSchemaKinds,
  };
}

export interface GenerateFakerForSchemasResult {
  implementation: string;
  imports: GeneratorImport[];
  strictMockSchemaTypeNames?: string[];
  strictMockSchemaKinds?: Record<string, StrictMockSchemaKind>;
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
  const strictMockTypeNames = new Set<string>();
  const strictMockSchemaKinds: Record<string, StrictMockSchemaKind> = {};
  const allImports: GeneratorImport[] = [];
  // Shared across schemas so we emit each helper (e.g. an `allOf`-discriminator
  // sub-factory) once even when several schemas reference the same union arm.
  const splitMockImplementations: string[] = [];

  // Names of the factories we're about to emit in this file. When the
  // delegation logic in `resolveMockValue` produces a `getXMock()` call for
  // a `components/schemas` ref, it pushes a `{ schemaFactory: true }` import
  // — but if `X` is itself one of the schemas being generated here, the
  // factory lives in this very file and must not be imported.
  const localFactoryNames = new Set(
    schemas.filter((s) => !!s.schema).map((s) => `get${pascal(s.name)}Mock`),
  );
  const localMockTypeNames = new Set(
    schemas
      .filter((s) => !!s.schema)
      .map((s) => getStrictMockTypeName(pascal(s.name))),
  );

  // Serialize override.mock.properties functions the same way operation
  // response mocks do (IIFE expressions), not raw function references.
  const mockOptions = getMockWithoutFunc(context.spec, context.output.override);

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
    const { param, returnType, returnCast } = getMockFactorySignatureParts(
      typeName,
      mockOptions,
      {
        isOverridable,
        overrideType: `Partial<${typeName}>`,
      },
    );
    const factory = formatMockFactoryDeclaration(
      factoryName,
      param,
      returnType,
      result.value,
      returnCast,
    );

    if (isStrictMock(mockOptions)) {
      strictMockTypeNames.add(typeName);
      strictMockSchemaKinds[typeName] = classifyStrictMockSchemaType(schema);
    }

    factories.push(factory);

    // Track the schema type itself as an import so writers can reference it
    // from the generated factory file.
    allImports.push({
      name: pascal(name),
      values: false,
    });
  }

  // De-duplicate imports by name+alias so the header doesn't list the same
  // schema twice when multiple factories reference it. "Any value wins":
  // if the same name is pushed both as a type-only import and as a value
  // import (e.g. an enum used both in an `as Foo` cast and an
  // `Object.values(Foo)` call), we keep the value form. A plain
  // `import { Foo }` works in both annotation and runtime positions, so
  // emitting the value form avoids `TS1361: 'X' cannot be used as a value
  // because it was imported using 'import type'`.
  const mergedImports = new Map<string, GeneratorImport>();
  for (const imp of allImports) {
    // Drop self-references: `get<Schema>Mock` factories generated in this
    // very file (pushed when delegation in `resolveMockValue` produced a
    // local factory call). Without this we'd emit
    // `import { getPetMock } from '.'` next to its own `export const`.
    if (imp.schemaFactory && localFactoryNames.has(imp.name)) continue;
    if (imp.schemaFactory && !imp.values && localMockTypeNames.has(imp.name)) {
      continue;
    }

    const key = `${imp.name}::${imp.alias ?? ''}`;
    const existing = mergedImports.get(key);
    if (!existing) {
      mergedImports.set(key, imp);
      continue;
    }
    if (!existing.values && imp.values) {
      mergedImports.set(key, imp);
    }
  }
  const uniqueImports = [...mergedImports.values()];

  // Reference `options` so unused-parameter rules don't complain; future
  // schema-specific behavior (e.g. naming convention) will read from it.
  void options;

  // Helper factories from union/discriminator handling (`splitMockImplementations`)
  // are emitted before the public `get<Schema>Mock` factories so call sites
  // declared after them resolve cleanly without TS hoisting concerns.
  const implementation = [...splitMockImplementations, ...factories]
    .filter(Boolean)
    .join('\n\n');

  for (const name of collectStrictMockSchemaTypeNamesFromImplementation(
    implementation,
  )) {
    strictMockTypeNames.add(name);
    strictMockSchemaKinds[name] ??= 'object';
  }

  const aggregatedStrictNames = [...strictMockTypeNames];

  return {
    implementation,
    imports: uniqueImports,
    strictMockSchemaTypeNames:
      aggregatedStrictNames.length > 0 ? aggregatedStrictNames : undefined,
    strictMockSchemaKinds: mergeStrictMockSchemaKinds(strictMockSchemaKinds),
  };
}
