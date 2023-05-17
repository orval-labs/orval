import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { getEnum } from '../getters/enum';
import { ContextSpecs, ResolverValue } from '../types';
import { isReference, jsDoc } from '../utils';
import { resolveValue } from './value';
import { resolveRef } from './ref';
import mergeWith from 'lodash.mergewith';

export const resolveObject = ({
  schema,
  propName,
  combined = false,
  context,
}: {
  schema: SchemaObject | ReferenceObject;
  propName?: string;
  combined?: boolean;
  context: ContextSpecs;
}): ResolverValue => {
  if (typeof schema === 'object' && (schema as SchemaObject)?.allOf) {
    const allOf = (schema as SchemaObject).allOf || [];
    let specKey = context.specKey;
    const object = allOf
      .map((v) => {
        if (isReference(v)) {
          const result = resolveRef<SchemaObject>(v, context);
          specKey = result.imports[0].specKey || specKey;
          return result.schema;
        }
        return v;
      })
      .reduce((prev, current) => {
        return mergeWith({}, prev, current, (a, b) => {
          if (Array.isArray(a) && Array.isArray(b)) {
            return a.concat(b);
          }
        });
      }, {});
    schema = mergeWith({}, schema, object, (a, b) => {
      if (Array.isArray(a) && Array.isArray(b)) {
        return a.concat(b);
      }
    });
    delete (schema as SchemaObject)['allOf'];
    context.specKey = specKey;
  }

  const resolvedValue = resolveValue({
    schema,
    name: propName,
    context,
  });
  const doc = jsDoc(resolvedValue.originalSchema ?? {});

  if (
    propName &&
    !resolvedValue.isEnum &&
    resolvedValue?.type === 'object' &&
    new RegExp(/{|&|\|/).test(resolvedValue.value)
  ) {
    return {
      value: propName,
      imports: [{ name: propName }],
      schemas: [
        ...resolvedValue.schemas,
        {
          name: propName,
          model: `${doc}export type ${propName} = ${resolvedValue.value};\n`,
          imports: resolvedValue.imports,
        },
      ],
      isEnum: false,
      type: 'object',
      originalSchema: resolvedValue.originalSchema,
      isRef: resolvedValue.isRef,
      hasReadonlyProps: resolvedValue.hasReadonlyProps,
    };
  }

  if (propName && resolvedValue.isEnum && !combined && !resolvedValue.isRef) {
    const enumValue = getEnum(
      resolvedValue.value,
      propName,
      resolvedValue.originalSchema?.['x-enumNames'],
    );

    return {
      value: propName,
      imports: [{ name: propName }],
      schemas: [
        ...resolvedValue.schemas,
        {
          name: propName,
          model: doc + enumValue,
          imports: resolvedValue.imports,
        },
      ],
      isEnum: false,
      type: 'enum',
      originalSchema: resolvedValue.originalSchema,
      isRef: resolvedValue.isRef,
      hasReadonlyProps: resolvedValue.hasReadonlyProps,
    };
  }

  return resolvedValue;
};
