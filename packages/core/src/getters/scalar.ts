import { isArray } from 'remeda';

import { resolveExampleRefs } from '../resolvers/index.ts';
import type {
  ContextSpec,
  OpenApiSchemaObject,
  OpenApiSchemaObjectType,
  ScalarValue,
} from '../types.ts';
import { getFormDataFieldFileType } from '../utils/content-type.ts';
import { escape, isString } from '../utils/index.ts';
import { getArray } from './array.ts';
import { combineSchemas } from './combine.ts';
import type { FormDataContext } from './object.ts';
import { getObject } from './object.ts';

/** Bridge type for enum values extracted from OpenAPI schemas infected by AnyOtherAttribute */
type SchemaEnumValue = string | number | boolean | null;

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
      let value = 'boolean' + nullable;

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
            isString(enumItem) ? `'${escape(enumItem)}'` : `${enumItem}`,
          )
          .filter(Boolean)
          .join(` | `);

        isEnum = true;
      }

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
            isString(enumItem) ? `'${escape(enumItem)}'` : String(enumItem),
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
