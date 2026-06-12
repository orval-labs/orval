import {
  escapeRegExp,
  type FinalizeMockImplementationOptions,
  type MockOptions,
  type OpenApiSchemaObject,
  type ResReqTypesValue,
  type StrictMockSchemaKind,
} from '@orval/core';

export type { StrictMockSchemaKind };

export function isStrictMock(
  mockOptions?: Pick<MockOptions, 'required' | 'nonNullable'>,
): boolean {
  return Boolean(
    mockOptions && mockOptions.required && mockOptions.nonNullable,
  );
}

export function getStrictMockTypeName(typeName: string): string {
  return `${typeName}Mock`;
}

export function getStrictMockHelperTypeDeclarations(): string {
  return `export type KeysWithNull<O> = {
  [K in keyof O]-?: null extends O[K] ? K : never;
}[keyof O];

export type MockWithNullableOverrides<
  T,
  O extends Partial<T>,
  M extends Record<keyof T, unknown>,
> = Omit<M, Extract<KeysWithNull<O>, keyof T>> & {
  [K in Extract<KeysWithNull<O>, keyof T>]: M[K] | null;
};`;
}

export function classifyStrictMockSchemaType(
  schema?: OpenApiSchemaObject,
): StrictMockSchemaKind {
  if (!schema) {
    return 'object';
  }

  if (
    schema.format === 'binary' ||
    (schema.contentMediaType === 'application/octet-stream' &&
      !schema.contentEncoding)
  ) {
    return 'binary';
  }

  if (
    typeof schema.$ref === 'string' ||
    schema.type === 'object' ||
    schema.properties ||
    schema.allOf ||
    schema.oneOf ||
    schema.anyOf
  ) {
    return 'object';
  }

  return 'alias';
}

export function getStrictMockTypeDeclaration(
  typeName: string,
  kind: StrictMockSchemaKind = 'object',
): string {
  const mockTypeName = getStrictMockTypeName(typeName);

  if (kind === 'alias') {
    return `export type ${mockTypeName} = ${typeName};`;
  }

  if (kind === 'binary') {
    return `export type ${mockTypeName} = ArrayBuffer;`;
  }

  return `export type ${mockTypeName} = {\n  [K in keyof Required<${typeName}>]: NonNullable<Required<${typeName}>[K]>;\n};`;
}

export function getStrictMockTypeDeclarations(
  typeNames: Iterable<string>,
  kinds?: Readonly<Record<string, StrictMockSchemaKind>>,
): string {
  const unique = [...new Set(typeNames)];
  if (unique.length === 0) {
    return '';
  }

  return unique
    .map((typeName) =>
      getStrictMockTypeDeclaration(typeName, kinds?.[typeName] ?? 'object'),
    )
    .join('\n\n');
}

export function getMockFactoryReturnType(
  typeName: string,
  mockOptions?: Pick<MockOptions, 'required' | 'nonNullable'>,
): string {
  return isStrictMock(mockOptions) ? getStrictMockTypeName(typeName) : typeName;
}

export interface MockFactorySignatureParts {
  param: string;
  returnType: string;
  returnCast: string;
}

export interface GetMockFactorySignaturePartsOptions {
  isOverridable?: boolean;
  overrideType?: string;
}

export function getMockFactorySignatureParts(
  typeName: string,
  mockOptions?: Pick<MockOptions, 'required' | 'nonNullable'>,
  options: GetMockFactorySignaturePartsOptions = {},
): MockFactorySignatureParts {
  const isOverridable = options.isOverridable ?? false;
  const overrideType = options.overrideType ?? `Partial<${typeName}>`;
  const mockTypeName = getStrictMockTypeName(typeName);

  if (!isOverridable) {
    return {
      param: '',
      returnType: getMockFactoryReturnType(typeName, mockOptions),
      returnCast: '',
    };
  }

  if (isStrictMock(mockOptions)) {
    return {
      param: `<O extends ${overrideType} = {}>(overrideResponse?: O)`,
      returnType: `MockWithNullableOverrides<${typeName}, O, ${mockTypeName}>`,
      returnCast: ` as MockWithNullableOverrides<${typeName}, O, ${mockTypeName}>`,
    };
  }

  return {
    param: `overrideResponse: ${overrideType} = {}`,
    returnType: typeName,
    returnCast: '',
  };
}

export function getSimpleSchemaReturnType(
  returnType: string,
  schemaTypeNames: string[],
): string | undefined {
  const trimmed = returnType.trim();
  return schemaTypeNames.includes(trimmed) ? trimmed : undefined;
}

export function formatMockFactoryDeclaration(
  factoryName: string,
  param: string,
  returnType: string,
  body: string,
  returnCast: string,
  options?: { omitReturnType?: boolean; terminateStatement?: boolean },
): string {
  const header = param
    ? param.startsWith('<')
      ? `export const ${factoryName} = ${param}`
      : `export const ${factoryName} = (${param})`
    : `export const ${factoryName} = ()`;

  const returnTypeAnnotation =
    options?.omitReturnType || !returnType ? '' : `: ${returnType}`;

  const statementTerminator =
    returnCast || options?.terminateStatement ? ';' : '';

  return `${header}${returnTypeAnnotation} => (${body})${returnCast}${statementTerminator}`;
}

export function getSchemaTypeNamesFromResponses(
  responses: ResReqTypesValue[],
): string[] {
  const names = new Set<string>();

  for (const response of responses) {
    for (const imp of response.imports) {
      if (imp.values || imp.schemaFactory) {
        continue;
      }

      const importName = imp.alias ?? imp.name;
      if (/^[A-Z]\w*$/.test(importName)) {
        names.add(importName);
      }
    }

    const { value } = response;
    if (!value) {
      continue;
    }

    const baseType = value.endsWith('[]') ? value.slice(0, -2) : value;
    if (/^[A-Z]\w*$/.test(baseType)) {
      names.add(baseType);
    }
  }

  return [...names];
}

export function getStrictMockSchemaKindsFromResponses(
  responses: ResReqTypesValue[],
): Record<string, StrictMockSchemaKind> {
  const kinds: Record<string, StrictMockSchemaKind> = {};

  for (const response of responses) {
    for (const imp of response.imports) {
      if (imp.values || imp.schemaFactory) {
        continue;
      }

      const importName = imp.alias ?? imp.name;
      if (/^[A-Z]\w*$/.test(importName) && response.originalSchema) {
        kinds[importName] = classifyStrictMockSchemaType(
          response.originalSchema,
        );
      }
    }

    const { value } = response;
    if (!value || !response.originalSchema) {
      continue;
    }

    const baseType = value.endsWith('[]') ? value.slice(0, -2) : value;
    if (!/^[A-Z]\w*$/.test(baseType)) {
      continue;
    }

    const schema = response.originalSchema;
    if (value.endsWith('[]') && schema.type === 'array' && schema.items) {
      const items = schema.items as OpenApiSchemaObject;
      kinds[baseType] =
        typeof items.$ref === 'string'
          ? 'object'
          : classifyStrictMockSchemaType(items);
      continue;
    }

    kinds[baseType] = classifyStrictMockSchemaType(schema);
  }

  return kinds;
}

export function buildStrictMockTypeFileHeader(
  schemaTypeNames: Iterable<string>,
  kinds?: Readonly<Record<string, StrictMockSchemaKind>>,
): string {
  const uniqueSchemaNames = [...new Set(schemaTypeNames)];
  const schemaBlock = getStrictMockTypeDeclarations(uniqueSchemaNames, kinds);

  return [getStrictMockHelperTypeDeclarations(), schemaBlock]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Prepends shared strict-mock helper types and each `{Schema}Mock` alias once at
 * the top of a mock file. Generators pass `strictSchemaTypeNames`; no scraping.
 *
 * Not idempotent — callers must invoke this exactly once per aggregated mock
 * file (writers and `writeFakerSchemaMocks`), not from import hooks.
 */
export function dedupeStrictMockTypeDeclarations(
  implementation: string,
  options: FinalizeMockImplementationOptions = {},
): string {
  if (!isStrictMock(options.mockOptions)) {
    return implementation;
  }

  const schemaTypeNames = options.strictSchemaTypeNames
    ? [...new Set(options.strictSchemaTypeNames)]
    : [];
  if (schemaTypeNames.length === 0) {
    return implementation;
  }

  const header = buildStrictMockTypeFileHeader(
    schemaTypeNames,
    options.strictMockSchemaKinds,
  );

  return `${header}\n\n${implementation.trimStart()}`;
}

export function applyStrictMockReturnType(
  returnType: string,
  schemaTypeNames: string[],
): string {
  if (schemaTypeNames.length === 0) {
    return returnType;
  }

  let result = returnType;
  const sorted = [...schemaTypeNames].toSorted((a, b) => b.length - a.length);

  for (const name of sorted) {
    result = result.replaceAll(
      new RegExp(String.raw`\b${escapeRegExp(name)}\b`, 'g'),
      getStrictMockTypeName(name),
    );
  }

  return result;
}

const STRICT_MOCK_SCHEMA_TYPE_FROM_OVERRIDES =
  /MockWithNullableOverrides<([A-Z]\w*),/g;
const STRICT_MOCK_SCHEMA_TYPE_FROM_OVERRIDE_ALIAS =
  /MockWithNullableOverrides<[^,]+,\s*[^,]+,\s*([A-Z]\w*Mock)>/g;
const STRICT_MOCK_SCHEMA_TYPE_FROM_MOCK_ALIAS_RETURN =
  /\): ([A-Z]\w*Mock)(?:\[\]|;)/g;

/** Inverse of {@link getStrictMockTypeName}: `PetMock` → `Pet`, `WidgetMockMock` → `WidgetMock`. */
function getSchemaTypeNameFromStrictMockAlias(alias: string): string {
  return alias.endsWith('Mock') ? alias.slice(0, -4) : alias;
}

/**
 * Collect schema type names referenced by strict mock factories in generated
 * implementation text (nested split factories, array item helpers, etc.).
 *
 * This reverse-parses emitted factory syntax and is therefore coupled to the
 * current `formatMockFactoryDeclaration` / `getMockFactorySignatureParts`
 * shape. The structurally robust alternative is to record each nested item's
 * schema name where split factories are generated (array-item / faker getters,
 * where the `$ref` name is known) and thread it into `strictMockSchemaTypeNames`.
 */
export function collectStrictMockSchemaTypeNamesFromImplementation(
  implementation: string,
): string[] {
  const names = new Set<string>();

  for (const match of implementation.matchAll(
    STRICT_MOCK_SCHEMA_TYPE_FROM_OVERRIDES,
  )) {
    names.add(match[1]);
  }

  for (const pattern of [
    STRICT_MOCK_SCHEMA_TYPE_FROM_OVERRIDE_ALIAS,
    STRICT_MOCK_SCHEMA_TYPE_FROM_MOCK_ALIAS_RETURN,
  ]) {
    for (const match of implementation.matchAll(pattern)) {
      names.add(getSchemaTypeNameFromStrictMockAlias(match[1]));
    }
  }

  return [...names];
}

export function mergeStrictMockSchemaTypeNames(
  ...groups: Array<Iterable<string> | undefined>
): string[] | undefined {
  const names = new Set<string>();

  for (const group of groups) {
    if (!group) continue;
    for (const name of group) {
      names.add(name);
    }
  }

  return names.size > 0 ? [...names] : undefined;
}

export function mergeStrictMockSchemaKinds(
  ...groups: Array<Readonly<Record<string, StrictMockSchemaKind>> | undefined>
): Record<string, StrictMockSchemaKind> | undefined {
  const merged: Record<string, StrictMockSchemaKind> = {};

  for (const group of groups) {
    if (!group) continue;
    for (const [name, kind] of Object.entries(group)) {
      merged[name] ??= kind;
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}
