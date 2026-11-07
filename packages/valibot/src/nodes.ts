import type { OpenApiSchemaObject } from '@orval/core';

/**
 * Typed intermediate tree between the schema walk and the renderer. Only kinds
 * the renderer knows are emitted, so nothing in the document picks a `v.*`.
 */

type ObjectMode = 'object' | 'strictObject' | 'looseObject';

// A list rather than a record, so a key such as `__proto__` is just data.
export interface ValibotEntry {
  key: string;
  value: ValibotNode;
}

export interface ObjectSchema {
  kind: 'object';
  mode: ObjectMode;
  entries: ValibotEntry[];
}

interface ObjectWithRestSchema {
  kind: 'objectWithRest';
  entries: ValibotEntry[];
  rest: ValibotNode;
}

interface VariantSchema {
  kind: 'variant';
  key: string;
  options: ValibotNode[];
}

export type ValibotSchema =
  | {
      kind:
        | 'never'
        | 'unknown'
        | 'string'
        | 'number'
        | 'boolean'
        | 'null'
        | 'file';
    }
  // `value` and `values` are JavaScript source of the literals.
  | { kind: 'literal'; value: string }
  | { kind: 'picklist'; values: string[] }
  | { kind: 'array'; item: ValibotNode }
  | { kind: 'record'; value: ValibotNode }
  | ObjectSchema
  | ObjectWithRestSchema
  | { kind: 'union' | 'intersect'; members: ValibotNode[] }
  | VariantSchema;

export type FlagActionKind =
  | 'integer'
  | 'isoDate'
  | 'isoTimestamp'
  | 'email'
  | 'url'
  | 'uuid'
  | 'ipv4'
  | 'ipv6'
  | 'base64';

type ValueActionKind =
  | 'minValue'
  | 'gtValue'
  | 'maxValue'
  | 'ltValue'
  | 'multipleOf'
  | 'minLength'
  | 'maxLength'
  | 'minCodePoints'
  | 'maxCodePoints';

export type ValibotAction =
  | { kind: FlagActionKind }
  | { kind: ValueActionKind; value: string }
  | { kind: 'regex'; pattern: string }
  | { kind: 'describe'; text: string }
  | { kind: 'toDate' };

export interface ValibotNode {
  schema: ValibotSchema;
  actions: ValibotAction[];
  nullable: boolean;
  optional: boolean;
  defaultValue?: string;
}

export interface BaseSchema {
  schema: ValibotSchema;
  actions: ValibotAction[];
}

export type ChildGenerator = (
  member: OpenApiSchemaObject | undefined,
  isRequired?: boolean,
) => ValibotNode;

export const plainNode = (schema: ValibotSchema): ValibotNode => ({
  schema,
  actions: [],
  nullable: false,
  optional: false,
});

export const plainBase = (schema: ValibotSchema): BaseSchema => ({
  schema,
  actions: [],
});
