import {
  escapeRegExp,
  type MockOptions,
  type ResReqTypesValue,
} from '@orval/core';

export function isStrictMock(
  mockOptions?: Pick<MockOptions, 'required' | 'nonNullable'>,
): boolean {
  return Boolean(mockOptions?.required && mockOptions?.nonNullable);
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
  M,
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

  return unique.map(getStrictMockTypeDeclaration).join('\n\n');
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
  options?: { omitReturnType?: boolean },
): string {
  const header = param
    ? param.startsWith('<')
      ? `export const ${factoryName} = ${param}`
      : `export const ${factoryName} = (${param})`
    : `export const ${factoryName} = ()`;

  const returnTypeAnnotation =
    options?.omitReturnType || !returnType ? '' : `: ${returnType}`;

  return `${header}${returnTypeAnnotation} => (${body})${returnCast};\n`;
}

export function getSchemaTypeNamesFromResponses(
  responses: ResReqTypesValue[],
): string[] {
  const names = new Set<string>();

  for (const response of responses) {
    for (const imp of response.imports) {
      names.add(imp.alias ?? imp.name);
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

export function applyStrictMockReturnType(
  returnType: string,
  schemaTypeNames: string[],
): string {
  if (schemaTypeNames.length === 0) {
    return returnType;
  }

  let result = returnType;
  const sorted = [...schemaTypeNames].sort((a, b) => b.length - a.length);

  for (const name of sorted) {
    result = result.replace(
      new RegExp(String.raw`\b${escapeRegExp(name)}\b`, 'g'),
      getStrictMockTypeName(name),
    );
  }

  return result;
}
