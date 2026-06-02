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

function getFileLevelExtractedFactories(context: ContextSpec): Set<string> {
  context.arrayItemMockFactories ??= new Set();
  return context.arrayItemMockFactories;
}

/**
 * True when the active faker generator entry opts into reusable array-item
 * mock factories for object-like array item schemas in operation responses.
 */
export function shouldExtractArrayItemFactories(context: ContextSpec): boolean {
  const fakerEntry = context.output.mock.generators.find(
    (g) =>
      !isFunction(g) &&
      g.type === OutputMockType.FAKER &&
      g.arrayItems === true,
  );
  return !!fakerEntry;
}

/**
 * True when `schemas: true` already emits a consolidated factory for this
 * `$ref` item under `components/schemas`, so we must not re-export it from
 * the operation mock file.
 */
function hasConsolidatedSchemaFactory(
  items: MockSchema,
  context: ContextSpec,
): boolean {
  if (!context.output.schemas) {
    return false;
  }

  const itemsRef = extractItemsRef(items);
  if (!itemsRef) {
    return false;
  }

  const { refPaths } = getRefInfo(itemsRef, context);
  const isComponentsSchema =
    Array.isArray(refPaths) &&
    refPaths[0] === 'components' &&
    refPaths[1] === 'schemas';

  if (!isComponentsSchema) {
    return false;
  }

  return context.output.mock.generators.some(
    (g) =>
      !isFunction(g) && g.type === OutputMockType.FAKER && g.schemas === true,
  );
}

/**
 * True when array `items` resolve to an object-like schema worth extracting.
 */
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

/**
 * True when `mapValue` is already a bare factory call or a single spread of one.
 */
function isAlreadyFactoryCall(mapValue: string): boolean {
  return /^(?:\{\s*\.\.\.\s*get\w+Mock\(\)\s*\}|get\w+Mock\(\))$/.test(
    mapValue.trim(),
  );
}

interface ArrayItemFactoryNames {
  factoryName: string;
  typeName: string;
}

/**
 * Derive the exported factory and TypeScript type names for an array item.
 */
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

  if (
    !mapValue ||
    mapValue === '[]' ||
    isAlreadyFactoryCall(mapValue) ||
    hasConsolidatedSchemaFactory(items, context)
  ) {
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
  const fileLevelFactories = getFileLevelExtractedFactories(context);
  const alreadyExtracted =
    fileLevelFactories.has(factoryName) ||
    splitMockImplementations.some((f) =>
      f.includes(`export const ${factoryName}`),
    );

  if (!alreadyExtracted) {
    const args = `${overrideVarName}: Partial<${typeName}> = {}`;
    const spreadPrefix = mapValue.startsWith('...') ? '' : '...';
    const func =
      `export const ${factoryName} = (${args}): ${typeName} => ` +
      `({${spreadPrefix}${mapValue}, ...${overrideVarName}});`;
    splitMockImplementations.push(func);
    fileLevelFactories.add(factoryName);
  }

  imports.push({ name: typeName });

  return `{...${factoryName}()}`;
}
