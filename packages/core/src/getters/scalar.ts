import { isArray } from 'remeda';

import { resolveExampleRefs } from '../resolvers';
import type {
  ContextSpec,
  OpenApiSchemaObject,
  OpenApiSchemaObjectType,
  ScalarValue,
} from '../types';
import { isString, jsStringEscape } from '../utils';
import { getFormDataFieldFileType } from '../utils/content-type';
import { getArray } from './array';
import { combineSchemas } from './combine';
import type { FormDataContext } from './object';
import { getObject } from './object';

/** Bridge type for enum values extracted from OpenAPI schemas infected by AnyOtherAttribute */
type SchemaEnumValue = string | number | boolean | null;

/**
 * Returns true when a schema describes a raw binary string scalar — i.e. one
 * that getScalar's `case 'string':` branch would coerce to `Blob` outside a
 * url-encoded context (see the formDataContext.urlEncoded gate below). Shared
 * with resolveValue so the component-`$ref` urlEncoded short-circuit and the
 * inline scalar path stay in lockstep when new binary shapes are added
 * (#1624 / #3395 / #2410).
 *
 * Accepts OAS 3.1 nullable unions (`type: ['string', 'null']`) since getScalar
 * normalizes those into `case 'string':` before invoking this predicate.
 */
export function isBinaryScalarSchema(schema: OpenApiSchemaObject): boolean {
  const schemaType = schema.type as
    | OpenApiSchemaObjectType
    | OpenApiSchemaObjectType[]
    | undefined;
  const isStringLike =
    schemaType === 'string' ||
    (isArray(schemaType) &&
      schemaType.includes('string') &&
      schemaType.every((type) => type === 'string' || type === 'null'));
  if (!isStringLike) {
    return false;
  }
  if (schema.format === 'binary') {
    return true;
  }
  // The @scalar/openapi-parser upgrader rewrites format: binary to
  // contentMediaType: application/octet-stream during Swagger 2.0 / OAS 3.0 →
  // OAS 3.1 upgrades; treat the upgraded shape the same. A non-empty
  // contentEncoding signals an encoded string payload (e.g. base64), not raw
  // binary.
  const contentMediaType = schema.contentMediaType as string | undefined;
  const contentEncoding = schema.contentEncoding as string | undefined;
  return contentMediaType === 'application/octet-stream' && !contentEncoding;
}

interface GetScalarOptions {
  item: OpenApiSchemaObject;
  name?: string;
  context: ContextSpec;
  formDataContext?: FormDataContext;
}

/**
 * Return the typescript equivalent of open-api data type
 *
 * @param item
 * @ref https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.1.1.md#data-types
 */
export function getScalar({
  item,
  name,
  context,
  formDataContext,
}: GetScalarOptions): ScalarValue {
  // Bridge assertions: extract typed values from AnyOtherAttribute-infected schema
  const schemaEnum = item.enum as SchemaEnumValue[] | undefined;
  const schemaType = item.type as
    | OpenApiSchemaObjectType
    | OpenApiSchemaObjectType[]
    | undefined;
  const schemaReadOnly = item.readOnly as boolean | undefined;
  const schemaExample = item.example as unknown;
  const schemaExamples = item.examples as Parameters<
    typeof resolveExampleRefs
  >[0];
  const schemaConst = item.const as string | undefined;
  const schemaFormat = item.format as string | undefined;
  const schemaNullable = item.nullable as boolean | undefined;

  const nullable =
    (isArray(schemaType) && schemaType.includes('null')) ||
    schemaNullable === true
      ? ' | null'
      : '';

  const enumItems = schemaEnum?.filter(
    (enumItem): enumItem is Exclude<SchemaEnumValue, null> => enumItem !== null,
  );

  let itemType:
    | OpenApiSchemaObjectType
    | OpenApiSchemaObjectType[]
    | undefined = schemaType;
  if (!itemType && item.items) {
    item.type = 'array';
    itemType = 'array';
  }
  if (isArray(schemaType) && schemaType.includes('null')) {
    const typesWithoutNull = schemaType.filter(
      (x): x is OpenApiSchemaObjectType => x !== 'null',
    );
    itemType =
      typesWithoutNull.length === 1 ? typesWithoutNull[0] : typesWithoutNull;
  }

  switch (itemType) {
    case 'number':
    case 'integer': {
      let value =
        context.output.override.useBigInt &&
        (schemaFormat === 'int64' || schemaFormat === 'uint64')
          ? 'bigint'
          : 'number';
      let isEnum = false;

      if (enumItems) {
        value = enumItems.map((enumItem) => `${enumItem}`).join(' | ');
        isEnum = true;
      }

      value += nullable;

      if (schemaConst !== undefined) {
        value = schemaConst;
      }

      return {
        value,
        isEnum,
        type: 'number',
        schemas: [],
        imports: [],
        isRef: false,
        hasReadonlyProps: schemaReadOnly ?? false,
        dependencies: [],
        example: schemaExample,
        examples: resolveExampleRefs(schemaExamples, context),
      };
    }

    case 'boolean': {
      let value = 'boolean';

      if (
        enumItems &&
        !(enumItems.includes(true) && enumItems.includes(false))
      ) {
        value = enumItems.map((enumItem) => `${enumItem}`).join(' | ');
      }

      value += nullable;

      if (schemaConst !== undefined) {
        value = schemaConst;
      }

      return {
        value: value,
        type: 'boolean',
        isEnum: false,
        schemas: [],
        imports: [],
        isRef: false,
        hasReadonlyProps: schemaReadOnly ?? false,
        dependencies: [],
        example: schemaExample,
        examples: resolveExampleRefs(schemaExamples, context),
      };
    }

    case 'array': {
      const { value, ...rest } = getArray({
        schema: item,
        name,
        context,
        formDataContext,
      });
      return {
        value: value + nullable,
        ...rest,
        dependencies: rest.dependencies,
      };
    }

    case 'string': {
      let value = 'string';
      let isEnum = false;

      if (enumItems) {
        value = enumItems
          .map((enumItem) =>
            isString(enumItem)
              ? `'${jsStringEscape(enumItem)}'`
              : `${enumItem}`,
          )
          .filter(Boolean)
          .join(` | `);

        isEnum = true;
      }

      // application/x-www-form-urlencoded bodies are built with URLSearchParams,
      // whose values are always strings. Skip Blob/file coercion so file/binary
      // fields stay `string`; enum unions computed above are left intact (#1624).
      if (!formDataContext?.urlEncoded) {
        if (schemaFormat === 'binary') {
          value = 'Blob';
        } else if (formDataContext?.atPart) {
          const fileType = getFormDataFieldFileType(
            item,
            formDataContext.partContentType,
          );
          if (fileType) {
            value = fileType === 'binary' ? 'Blob' : 'Blob | string';
          }
        } else if (isBinaryScalarSchema(item)) {
          // The previous arm caught format: binary directly; this matches the
          // OAS 3.1 contentMediaType: application/octet-stream variant via the
          // shared predicate so any future binary shapes added there flow
          // through here too (#2410).
          value = 'Blob';
        }
      }

      if (
        context.output.override.useDates &&
        (schemaFormat === 'date' || schemaFormat === 'date-time')
      ) {
        value = 'Date';
      }

      value += nullable;

      if (schemaConst) {
        value = `'${schemaConst}'`;
      }

      return {
        value: value,
        isEnum,
        type: 'string',
        imports: [],
        schemas: [],
        isRef: false,
        hasReadonlyProps: schemaReadOnly ?? false,
        dependencies: [],
        example: schemaExample,
        examples: resolveExampleRefs(schemaExamples, context),
      };
    }

    case 'null': {
      // Some OAS 3.1 generators emit a nullable composition in the
      // non-canonical form `{ type: 'null', allOf|oneOf|anyOf: [...] }`
      // (e.g. Swashbuckle with UseAllOfToExtendReferenceSchemas; passed
      // through by @scalar/openapi-upgrader) rather than the canonical
      // `{ anyOf: [...], type: 'null' }` member form. Treat the composition as
      // the value and `null` as a union member so this yields `T | null`
      // instead of collapsing to `null` and dropping the refs.
      const itemAllOf = item.allOf as unknown[] | undefined;
      const itemOneOf = item.oneOf as unknown[] | undefined;
      const itemAnyOf = item.anyOf as unknown[] | undefined;
      let separator: 'allOf' | 'oneOf' | 'anyOf' | undefined;
      if (itemAllOf?.length) {
        separator = 'allOf';
      } else if (itemOneOf?.length) {
        separator = 'oneOf';
      } else if (itemAnyOf?.length) {
        separator = 'anyOf';
      }
      if (separator) {
        // Drop the consumed `type: 'null'` before delegating: its nullability
        // is carried by `nullable` below, and leaving it on the schema makes
        // combineSchemas' merged-properties recursion re-enter this `case` and
        // collapse the object part back to `null`.
        const schemaWithoutNull = Object.fromEntries(
          Object.entries(item as Record<string, unknown>).filter(
            ([key]) => key !== 'type',
          ),
        ) as OpenApiSchemaObject;
        return combineSchemas({
          schema: schemaWithoutNull,
          name,
          separator,
          context,
          nullable: nullable || ' | null',
          formDataContext,
        });
      }

      return {
        value: 'null',
        isEnum: false,
        type: 'null',
        imports: [],
        schemas: [],
        isRef: false,
        hasReadonlyProps: schemaReadOnly ?? false,
        dependencies: [],
      };
    }

    default: {
      if (isArray(itemType)) {
        const anyOfVariants = itemType.map((type) =>
          Object.assign({}, item, { type }),
        ) as OpenApiSchemaObject[];
        return combineSchemas({
          schema: { anyOf: anyOfVariants } as OpenApiSchemaObject,
          name,
          separator: 'anyOf',
          context,
          nullable,
        });
      }

      if (enumItems) {
        const value = enumItems
          .map((enumItem) =>
            isString(enumItem)
              ? `'${jsStringEscape(enumItem)}'`
              : String(enumItem),
          )
          .filter(Boolean)
          .join(` | `);

        return {
          value: value + nullable,
          isEnum: true,
          type: 'string',
          imports: [],
          schemas: [],
          isRef: false,
          hasReadonlyProps: schemaReadOnly ?? false,
          dependencies: [],
          example: schemaExample,
          examples: resolveExampleRefs(schemaExamples, context),
        };
      }

      // Determine if we should pass form-data context:
      // - atPart: false -> always pass (navigating to properties)
      // - atPart: true + combiner -> pass (combiner members are still the same part)
      // - atPart: true + plain object -> don't pass (nested properties are JSON)
      const hasCombiners = (item.allOf ?? item.anyOf ?? item.oneOf) as
        | unknown[]
        | undefined;
      const shouldPassContext =
        formDataContext?.atPart === false ||
        (formDataContext?.atPart && hasCombiners);

      const { value, ...rest } = getObject({
        item,
        name,
        context,
        nullable,
        formDataContext: shouldPassContext ? formDataContext : undefined,
      });
      return { value: value, ...rest };
    }
  }
}
