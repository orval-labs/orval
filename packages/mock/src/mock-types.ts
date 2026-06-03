import {
  escapeRegExp,
  type MockOptions,
  type ResReqTypesValue,
} from '@orval/core';

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

export function getStrictMockTypeDeclaration(typeName: string): string {
  const mockTypeName = getStrictMockTypeName(typeName);
  return `export type ${mockTypeName} = {\n  [K in keyof Required<${typeName}>]: NonNullable<Required<${typeName}>[K]>;\n};`;
}

export function getStrictMockTypeDeclarations(
  typeNames: Iterable<string>,
): string {
  const unique = [...new Set(typeNames)];
  if (unique.length === 0) {
    return '';
  }

  return unique
    .map((typeName) => getStrictMockTypeDeclaration(typeName))
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

const STRICT_MOCK_SCHEMA_DECL_PATTERN =
  /export type (\w+) = \{\n  \[K in keyof Required<(\w+)>]: NonNullable<Required<\2>\[K\]>;\n\};/g;

/** Removes invalid strict-mock aliases emitted for value imports (e.g. getPetMockMock). */
const INVALID_STRICT_MOCK_DECL_PATTERN =
  /export type get\w+Mock = \{[\s\S]*?\};\n*/g;

export function collectStrictMockSchemaTypeNames(
  implementation: string,
): string[] {
  const names = new Set<string>();

  for (const match of implementation.matchAll(
    STRICT_MOCK_SCHEMA_DECL_PATTERN,
  )) {
    names.add(match[2]);
  }

  return [...names];
}

export function collectStrictMockSchemaNamesFromUsage(
  implementation: string,
): string[] {
  const names = new Set<string>();

  for (const match of implementation.matchAll(
    /MockWithNullableOverrides<(\w+),/g,
  )) {
    names.add(match[1]);
  }

  for (const match of implementation.matchAll(/\b([A-Z]\w*)Mock\b/g)) {
    names.add(match[1]);
  }

  return [...names];
}

export function buildStrictMockTypeFileHeader(
  schemaTypeNames: Iterable<string>,
): string {
  const uniqueSchemaNames = [...new Set(schemaTypeNames)];
  const schemaBlock = getStrictMockTypeDeclarations(uniqueSchemaNames);

  return [getStrictMockHelperTypeDeclarations(), schemaBlock]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * MSW/faker operation mocks are concatenated per file with no dedup. Hoist the
 * shared strict-mock helper types and each `{Schema}Mock` alias once at the top.
 */
export function usesStrictMockInImplementation(
  implementation: string,
): boolean {
  return (
    implementation.includes('export type KeysWithNull') ||
    implementation.includes('MockWithNullableOverrides<') ||
    /\b[A-Z]\w*Mock\b/.test(implementation)
  );
}

export function dedupeStrictMockTypeDeclarations(
  implementation: string,
): string {
  let body = implementation.replace(INVALID_STRICT_MOCK_DECL_PATTERN, '');

  if (!usesStrictMockInImplementation(body)) {
    return body;
  }

  const schemaTypeNames = [
    ...new Set([
      ...collectStrictMockSchemaTypeNames(body),
      ...collectStrictMockSchemaNamesFromUsage(body),
    ]),
  ];
  const helperBlock = getStrictMockHelperTypeDeclarations();

  body = body.replaceAll(helperBlock, '');

  for (const typeName of schemaTypeNames) {
    body = body.replaceAll(getStrictMockTypeDeclaration(typeName), '');
  }

  const trimmedBody = body.replace(/^\n+/, '').trimStart();
  const header = buildStrictMockTypeFileHeader(schemaTypeNames);

  return header ? `${header}\n\n${trimmedBody}` : trimmedBody;
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
