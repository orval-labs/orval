import { toJsLiteral } from '@orval/core';

import type {
  ObjectSchema,
  ValibotAction,
  ValibotEntry,
  ValibotNode,
} from './nodes';

// `v.toDate()` needs valibot 1.2; a transform keeps every 1.x release working.
const TO_DATE = 'v.transform((value) => new Date(value))';

const renderKey = (key: string) =>
  key === '__proto__'
    ? "['__proto__']"
    : /^[A-Za-z_$][\w$]*$/.test(key)
      ? key
      : toJsLiteral(key);

export interface RenderOptions {
  exactOptional?: boolean;
}

interface RenderPosition {
  inIntersection?: boolean;
  inEntry?: boolean;
}

const renderAction = (
  action: ValibotAction,
  inIntersection: boolean,
): string | undefined => {
  switch (action.kind) {
    case 'describe': {
      return `v.description(${action.text})`;
    }
    case 'minCodePoints':
    case 'maxCodePoints': {
      // Code points are between half and all of the UTF-16 units, so the string is
      // only split when its length is within twice the bound.
      const isMin = action.kind === 'minCodePoints';
      const count = Number(action.value);
      const test = isMin
        ? `value.length >= ${count * 2} || [...value].length >= ${count}`
        : `value.length <= ${count} || (value.length <= ${count * 2} && [...value].length <= ${count})`;
      return `v.check((value) => ${test}, 'Invalid length: Expected ${isMin ? '>=' : '<='}${count}')`;
    }
    case 'toDate': {
      // A transformed member would not merge with its siblings.
      return inIntersection ? undefined : TO_DATE;
    }
    case 'regex': {
      return `v.regex(${action.pattern})`;
    }
    default: {
      return 'value' in action
        ? `v.${action.kind}(${action.value})`
        : `v.${action.kind}()`;
    }
  }
};

export const renderValibot = (
  input: ValibotNode,
  { exactOptional = false }: RenderOptions = {},
): string => {
  const renderEntries = (entries: ValibotEntry[]) =>
    entries.length === 0
      ? '{}'
      : `{\n${entries.map(({ key, value }) => `  ${renderKey(key)}: ${render(value, { inEntry: true })}`).join(',\n')}\n}`;

  const renderObject = (schema: ObjectSchema, inIntersection: boolean) => {
    // A strict member of an intersection would reject its siblings' keys.
    const name =
      schema.mode === 'strictObject' && inIntersection ? 'object' : schema.mode;
    return `v.${name}(${renderEntries(schema.entries)})`;
  };

  const renderSchema = (
    { schema }: ValibotNode,
    inIntersection: boolean,
  ): string => {
    switch (schema.kind) {
      case 'literal': {
        return `v.literal(${schema.value})`;
      }
      case 'picklist': {
        return `v.picklist([${schema.values.join(', ')}])`;
      }
      case 'array': {
        return `v.array(${render(schema.item)})`;
      }
      case 'record': {
        return `v.record(v.string(), ${render(schema.value)})`;
      }
      case 'object': {
        return renderObject(schema, inIntersection);
      }
      case 'objectWithRest': {
        return `v.objectWithRest(${renderEntries(schema.entries)}, ${render(schema.rest)})`;
      }
      case 'union': {
        return schema.members.length === 1
          ? render(schema.members[0], { inIntersection })
          : `v.union([${schema.members.map((member) => render(member, { inIntersection })).join(', ')}])`;
      }
      case 'intersect': {
        return schema.members.length === 1
          ? render(schema.members[0], { inIntersection })
          : `v.intersect([${schema.members.map((member) => render(member, { inIntersection: true })).join(', ')}])`;
      }
      case 'variant': {
        return `v.variant(${toJsLiteral(schema.key)}, [${schema.options.map((option) => render(option, { inIntersection })).join(', ')}])`;
      }
      default: {
        return `v.${schema.kind}()`;
      }
    }
  };

  const render = (
    node: ValibotNode,
    { inIntersection = false, inEntry = false }: RenderPosition = {},
  ): string => {
    const isExact = exactOptional && inEntry;
    const optionalFn = isExact ? 'v.exactOptional' : 'v.optional';
    const actions = node.actions.flatMap((action) => {
      const rendered = renderAction(action, inIntersection);
      return rendered === undefined ? [] : [rendered];
    });

    let out = renderSchema(node, inIntersection);
    if (actions.length > 0) out = `v.pipe(${out}, ${actions.join(', ')})`;
    const hasDefault = node.defaultValue !== undefined;
    // `v.nullish` with a default would also replace null, and valibot has no
    // exact variant of it.
    if (node.nullable && node.optional && !hasDefault && !isExact) {
      return `v.nullish(${out})`;
    }
    if (node.nullable) out = `v.nullable(${out})`;
    if (hasDefault) return `${optionalFn}(${out}, ${node.defaultValue})`;
    return node.optional ? `${optionalFn}(${out})` : out;
  };

  return render(input);
};
