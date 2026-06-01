import {
  type ContextSpec,
  type GeneratorImport,
  getRefInfo,
  isFunction,
  isReference,
  type OpenApiSchemaObject,
  OutputMockType,
  pascal,
} from '@orval/core';

import type { MockSchema } from '../../types';
import { overrideVarName } from './object';
import { extractItemsRef } from './scalar';

/**
 * True when the active faker generator entry opts into reusable array-item
 * mock factories for object-like array item schemas in operation responses.
 */
export function shouldExtractArrayItemFactories(context: ContextSpec): boolean {
  const generators = context.output.mock?.generators;
  if (!generators) {
    return false;
  }

  const fakerEntry = generators.find(
    (g) =>
      !isFunction(g) &&
      g.type === OutputMockType.FAKER &&
      g.arrayItems === true,
  );
  return !!fakerEntry;
}

function isObjectLikeArrayItem(items: MockSchema): boolean {
  if (isReference(items)) {
    return true;
  }

  const schema = items as OpenApiSchemaObject;
  if (schema.type === 'object' || schema.properties) {
    return true;
  }

  if (schema.allOf || schema.oneOf || schema.anyOf) {
    return true;
  }

  return false;
}

function isAlreadyFactoryCall(mapValue: string): boolean {
  return /\bget\w+Mock\(\)/.test(mapValue);
}

interface ArrayItemFactoryNames {
  factoryName: string;
  typeName: string;
}

function getArrayItemFactoryNames({
  items,
  propertyName,
  parentName,
  operationId,
  context,
}: {
  items: MockSchema;
  propertyName: string;
  parentName?: string;
  operationId: string;
  context: ContextSpec;
}): ArrayItemFactoryNames | undefined {
  const itemsRef = extractItemsRef(items);
  if (itemsRef) {
    const { name } = getRefInfo(itemsRef, context);
    const typeName = pascal(name);
    return {
      factoryName: `get${typeName}Mock`,
      typeName,
    };
  }

  if (!isObjectLikeArrayItem(items)) {
    return undefined;
  }

  const itemSuffix = context.output.override.components.schemas.itemSuffix;
  const typeName = parentName
    ? `${pascal(parentName)}${pascal(propertyName)}${itemSuffix}`
    : `${pascal(operationId)}${pascal(propertyName)}${itemSuffix}`;
  return {
    factoryName: `get${pascal(operationId)}Response${pascal(propertyName)}ItemMock`,
    typeName,
  };
}

interface ExtractArrayItemMockOptions {
  items: MockSchema;
  propertyName: string;
  parentName?: string;
  operationId: string;
  mapValue: string;
  context: ContextSpec;
  splitMockImplementations: string[];
  imports: GeneratorImport[];
}

/**
 * When `arrayItems: true`, lift an object-like array item mock body into a
 * reusable exported factory and return the call site expression for `.map()`.
 */
export function extractArrayItemMock({
  items,
  propertyName,
  parentName,
  operationId,
  mapValue,
  context,
  splitMockImplementations,
  imports,
}: ExtractArrayItemMockOptions): string | undefined {
  if (!shouldExtractArrayItemFactories(context)) {
    return undefined;
  }

  if (!mapValue || mapValue === '[]' || isAlreadyFactoryCall(mapValue)) {
    return undefined;
  }

  const names = getArrayItemFactoryNames({
    items,
    propertyName,
    parentName,
    operationId,
    context,
  });
  if (!names) {
    return undefined;
  }

  const { factoryName, typeName } = names;

  if (
    !splitMockImplementations.some((f) =>
      f.includes(`export const ${factoryName}`),
    )
  ) {
    const args = `${overrideVarName}: Partial<${typeName}> = {}`;
    const spreadPrefix = mapValue.startsWith('...') ? '' : '...';
    const func =
      `export const ${factoryName} = (${args}): ${typeName} => ` +
      `({${spreadPrefix}${mapValue}, ...${overrideVarName}});`;
    splitMockImplementations.push(func);
  }

  imports.push({ name: typeName });

  return `{...${factoryName}()}`;
}
