import {
  type ContextSpec,
  DefaultTag,
  type GeneratorImport,
  getRefInfo,
  isFunction,
  isReference,
  kebab,
  type OpenApiSchemaObject,
  OutputMockType,
  OutputMode,
  pascal,
  resolveRef,
} from '@orval/core';

import {
  formatMockFactoryDeclaration,
  getMockFactorySignatureParts,
} from '../../mock-types';
import type { MockSchema } from '../../types';
import { overrideVarName } from './object';
import { extractItemsRef } from './scalar';

/**
 * Scope key for file-level array-item factory dedup. Must match how writers
 * group mock output: one bucket per tag file in tags modes, otherwise one
 * bucket for the whole target.
 */
export function getArrayItemMockFileScope(
  context: ContextSpec,
  tags: string[],
): string {
  const mode = context.output.mode;
  if (mode === OutputMode.TAGS || mode === OutputMode.TAGS_SPLIT) {
    const tag = tags.length > 0 ? tags[0] : DefaultTag;
    return `tag:${kebab(tag)}`;
  }
  if (mode === OutputMode.SPLIT) {
    return 'split';
  }
  return 'single';
}

function getFileLevelExtractedFactories(
  context: ContextSpec,
  scope: string,
): Set<string> {
  context.arrayItemMockFactories ??= new Map();
  const existing = context.arrayItemMockFactories.get(scope);
  if (existing) {
    return existing;
  }
  const factories = new Set<string>();
  context.arrayItemMockFactories.set(scope, factories);
  return factories;
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
 * True when `parentName` looks like a nested property key rather than the
 * generated response wrapper type (e.g. `outer` vs `GetTenants200`). Inlining
 * avoids factory/type-name collisions and mismatched `<Parent><Prop>Item` aliases.
 */
function isAmbiguousInlineItemContext(
  operationId: string,
  parentName?: string,
): boolean {
  if (!parentName) {
    return false;
  }

  return !parentName.toLowerCase().includes(operationId.toLowerCase());
}

function isNullableArrayItem(schema: OpenApiSchemaObject): boolean {
  if (schema.nullable === true) {
    return true;
  }

  return Array.isArray(schema.type) && schema.type.includes('null');
}

function isResolvedSchemaObjectLike(schema: OpenApiSchemaObject): boolean {
  if (schema.type === 'object' || schema.properties) {
    return true;
  }

  if (schema.allOf) {
    return true;
  }

  return false;
}

/**
 * True when array `items` resolve to an object-like schema worth extracting.
 * Conservative: skips scalar refs, oneOf/anyOf, nullable items, and nested
 * contexts where generated item type names cannot be inferred reliably.
 */
function shouldExtractArrayItem(
  items: MockSchema,
  context: ContextSpec,
  operationId: string,
  parentName?: string,
): boolean {
  const itemsRef = extractItemsRef(items);

  if (itemsRef) {
    try {
      const { schema } = resolveRef<OpenApiSchemaObject>(
        { $ref: itemsRef },
        context,
      );
      return isResolvedSchemaObjectLike(schema);
    } catch {
      return false;
    }
  }

  if (isReference(items)) {
    return false;
  }

  const schema = items as OpenApiSchemaObject;

  if (isNullableArrayItem(schema)) {
    return false;
  }

  if (schema.oneOf || schema.anyOf) {
    return false;
  }

  if (schema.allOf) {
    return true;
  }

  if (schema.type === 'object' || schema.properties) {
    return !isAmbiguousInlineItemContext(operationId, parentName);
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
  if (!shouldExtractArrayItem(items, context, operationId, parentName)) {
    return undefined;
  }

  const itemsRef = extractItemsRef(items);
  if (itemsRef) {
    const { name } = getRefInfo(itemsRef, context);
    const typeName = pascal(name);
    return {
      factoryName: `get${typeName}Mock`,
      typeName,
    };
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
  tags: string[];
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
  tags,
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
  const scope = getArrayItemMockFileScope(context, tags);
  const fileLevelFactories = getFileLevelExtractedFactories(context, scope);
  const alreadyExtracted =
    fileLevelFactories.has(factoryName) ||
    splitMockImplementations.some((f) =>
      f.includes(`export const ${factoryName}`),
    );

  if (!alreadyExtracted) {
    const mockOptions = context.output.override.mock;
    const { param, returnType, returnCast } = getMockFactorySignatureParts(
      typeName,
      mockOptions,
      {
        isOverridable: true,
        overrideType: `Partial<${typeName}>`,
      },
    );
    const spreadPrefix = mapValue.startsWith('...') ? '' : '...';
    const func = formatMockFactoryDeclaration(
      factoryName,
      param,
      returnType,
      `{${spreadPrefix}${mapValue}, ...${overrideVarName}}`,
      returnCast,
    );
    splitMockImplementations.push(func);
    fileLevelFactories.add(factoryName);
  }

  imports.push({ name: typeName });

  return `{...${factoryName}()}`;
}
