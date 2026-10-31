import {
  assertSafeNumericConstraint,
  isOctetStreamContentType,
  jsStringLiteralEscape,
  type OpenApiNonBooleanSchemaObject,
} from '@orval/core';

import { warnOnce } from './logger';
import {
  type BaseSchema,
  type FlagActionKind,
  plainBase,
  type ValibotAction,
} from './nodes';

const FORMATS = new Map<string, FlagActionKind>([
  ['email', 'email'],
  ['uri', 'url'],
  ['uuid', 'uuid'],
  ['ipv4', 'ipv4'],
  ['ipv6', 'ipv6'],
  ['byte', 'base64'],
]);

export const numberActions = (
  schema: OpenApiNonBooleanSchemaObject,
): ValibotAction[] => {
  const constraints = [
    ['minValue', schema.minimum, 'minimum'],
    ['gtValue', schema.exclusiveMinimum, 'exclusiveMinimum'],
    ['maxValue', schema.maximum, 'maximum'],
    ['ltValue', schema.exclusiveMaximum, 'exclusiveMaximum'],
    ['multipleOf', schema.multipleOf, 'multipleOf'],
  ] as const;
  return constraints.flatMap(([kind, value, label]): ValibotAction[] => {
    if (kind === 'multipleOf' && !Number.isInteger(value)) {
      // `v.multipleOf` uses `%`, which rejects valid decimals such as 19.99.
      if (value !== undefined) {
        assertSafeNumericConstraint(value, label);
        warnOnce(`Skipping non-integer multipleOf ${value}.`);
      }
      return [];
    }
    return value === undefined
      ? []
      : [{ kind, value: `${assertSafeNumericConstraint(value, label)}` }];
  });
};

export const sizeActions = (
  kind: 'string' | 'array',
  schema: OpenApiNonBooleanSchemaObject,
): ValibotAction[] => {
  const [min, max] =
    kind === 'array'
      ? [schema.minItems, schema.maxItems]
      : [schema.minLength, schema.maxLength];
  // JSON Schema counts code points, `v.minLength` counts UTF-16 units.
  const [minKind, maxKind] =
    kind === 'array'
      ? (['minLength', 'maxLength'] as const)
      : (['minCodePoints', 'maxCodePoints'] as const);
  const actions: ValibotAction[] = [];
  if (min !== undefined) {
    actions.push({
      // A minimum of 0 or 1 reads the same in code units and code points.
      kind: kind === 'string' && Number(min) <= 1 ? 'minLength' : minKind,
      value: `${assertSafeNumericConstraint(min, 'minLength/minItems')}`,
    });
  }
  if (max !== undefined) {
    actions.push({
      kind: maxKind,
      value: `${assertSafeNumericConstraint(max, 'maxLength/maxItems')}`,
    });
  }
  return actions;
};

export const patternActions = (pattern: string): ValibotAction[] => {
  // `\p{...}` only means a Unicode property with the `u` flag.
  const flags = /(^|[^\\])(?:\\\\)*\\[pPu]\{/.test(pattern) ? 'u' : '';
  // A pattern JavaScript cannot compile (`(?i)`, `\A`, ...) would throw
  // when the generated module loads, so it is skipped instead.
  try {
    new RegExp(pattern, flags);
    return [
      {
        kind: 'regex',
        pattern: `new RegExp('${jsStringLiteralEscape(pattern)}'${flags ? `, '${flags}'` : ''})`,
      },
    ];
  } catch {
    warnOnce(`Skipping pattern that is not a JavaScript RegExp: ${pattern}`);
    return [];
  }
};

export const stringBase = (
  schema: OpenApiNonBooleanSchemaObject,
  urlEncoded = false,
): BaseSchema => {
  if (
    !urlEncoded &&
    (schema.format === 'binary' ||
      (isOctetStreamContentType(schema.contentMediaType) &&
        !schema.contentEncoding))
  ) {
    return plainBase({ kind: 'file' });
  }
  const actions: ValibotAction[] = [];
  if (schema.format === 'date') actions.push({ kind: 'isoDate' });
  if (schema.format === 'date-time') actions.push({ kind: 'isoTimestamp' });
  const format =
    FORMATS.get(schema.format ?? '') ??
    (schema.contentEncoding === 'base64' ? 'base64' : undefined);
  if (format) actions.push({ kind: format });
  return { schema: { kind: 'string' }, actions };
};
