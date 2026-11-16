import {
  camel,
  isObject,
  omitDirectional,
  type SchemaParsers,
} from '@orval/core';

import {
  dereference,
  type EffectValidationSchemaDefinition,
  generateEffectValidationSchemaDefinition,
  generateFormDataEffectSchema,
  parseParameters,
} from '.';
import { warnOnce } from './logger';
import { createRefPolicy } from './ref-policy';
import { fieldsOf } from './refs';

type Definition = EffectValidationSchemaDefinition;

const MULTIPART_TYPE = /^multipart\/form-data$/;
const URL_ENCODED_TYPE = /^application\/x-www-form-urlencoded$/;

const isEmpty = ({ functions }: Definition): boolean => functions.length === 0;

// A location without parameters has no schema, rather than an empty struct.
const nonEmpty = (definition: Definition): Definition | undefined =>
  isEmpty(definition) ? undefined : definition;

/** The operation schemas `schemas: { type: 'effect' }` writes as Effect schemas. */
export const EFFECT_PARSERS: SchemaParsers<Definition> = {
  library: 'effect',
  options: (override) => override.effect,
  parseBody: ({
    name,
    media: [mediaType, media],
    context,
    strict,
    exactOptional,
    generate,
    operation,
  }) => {
    if (!generate || !(isObject(media.schema) || media.schema === true)) return;
    const contentType = mediaType.split(';')[0].trim().toLowerCase();
    const isMultipart = MULTIPART_TYPE.test(contentType);
    const isForm = isMultipart || URL_ENCODED_TYPE.test(contentType);
    // Form fields are rebuilt from the inlined tree.
    const resolved = omitDirectional(
      dereference(
        media.schema,
        context,
        isForm
          ? undefined
          : createRefPolicy({ context, exactOptional, direction: 'readOnly' }),
        `${operation} request body`,
      ),
      'readOnly',
    );
    return isMultipart
      ? generateFormDataEffectSchema(
          resolved,
          context,
          camel(name),
          strict,
          media.encoding,
        )
      : generateEffectValidationSchemaDefinition(
          resolved,
          context,
          camel(name),
          strict,
          { required: true, urlEncoded: isForm },
        );
  },
  parseSchema: ({
    name,
    schema,
    context,
    strict,
    exactOptional,
    label,
    direction,
  }) =>
    generateEffectValidationSchemaDefinition(
      omitDirectional(
        dereference(
          schema,
          context,
          createRefPolicy({ context, exactOptional, direction }),
          label,
        ),
        direction,
      ),
      context,
      camel(name),
      strict,
      { required: true },
    ),
  parseParameters: ({ data, context, strict, generate, operation }) => {
    const { params, queryParams, headers } = parseParameters({
      data,
      context,
      operationName: operation,
      strict,
      generate,
    });
    return {
      params: nonEmpty(params),
      queryParams: nonEmpty(queryParams),
      headers: nonEmpty(headers),
    };
  },
  withPathParamNames: ({ functions, consts }, rename) => ({
    consts,
    functions: functions.map(([fn, arg]): [string, unknown] =>
      fn === 'object' || fn === 'strictObject'
        ? [
            fn,
            Object.fromEntries(
              fieldsOf(arg).map(([key, field]) => [rename(key), field]),
            ),
          ]
        : [fn, arg],
    ),
  }),
  anyKeys: { functions: [['looseObject', {}]], consts: [] },
  unknown: { functions: [['unknown', undefined]], consts: [] },
  warn: warnOnce,
};
