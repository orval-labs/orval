import type { ValibotEntry, ValibotNode } from './nodes';
import { renderKey } from './render';

export interface TypeRenderOptions {
  direction: 'input' | 'output';
  exactOptional?: boolean;
  // The constants whose types the module declares, each with the name of its
  // input type; the output type has the name of the constant. A reference to
  // one names the declared type instead of inferring it from the constant.
  declared: ReadonlyMap<string, string>;
  // The output type of a declared constant when it is not named like the
  // constant.
  outputNames?: ReadonlyMap<string, string>;
  // The referenced constants that are read directly, not through `v.lazy`,
  // and are a pipe holding `v.readonly()`.
  readonlyRefs?: ReadonlySet<string>;
}

/**
 * Whether the schema `renderValibot` emits for a node is a pipe holding
 * `v.readonly()`. valibot makes the object key or record that holds such a
 * schema readonly. `readonlyRefs` names the referenced constants that are.
 */
export const hasReadonlyPipe = (
  node: ValibotNode,
  readonlyRefs: ReadonlySet<string>,
): boolean => {
  // `v.optional()`, `v.nullable()` and a default wrap the pipe.
  if (node.optional || node.nullable || node.defaultValue !== undefined) {
    return false;
  }
  if (node.actions.length > 0) {
    return node.actions.some((action) => action.kind === 'readonly');
  }
  const { schema } = node;
  if (schema.kind === 'ref') return readonlyRefs.has(schema.name);
  // `renderValibot` emits a lone member in place of its union or intersection.
  return (
    (schema.kind === 'union' || schema.kind === 'intersect') &&
    schema.members.length === 1 &&
    hasReadonlyPipe(schema.members[0], readonlyRefs)
  );
};

// How tightly the text binds, from an atom such as `string[]` to a union. An
// array item that is not an atom, and a union inside an intersection, need
// parentheses.
type Binding = 'atom' | 'operator' | 'intersection' | 'union';

interface TypeText {
  text: string;
  binding: Binding;
}

const atom = (text: string): TypeText => ({ text, binding: 'atom' });

const arrayItem = ({ text, binding }: TypeText) =>
  binding === 'atom' ? text : `(${text})`;

const join = (types: TypeText[], operator: '|' | '&'): TypeText => {
  if (types.length === 1) return types[0];
  const isUnion = operator === '|';
  const text = types
    .map(({ text, binding }) =>
      !isUnion && binding === 'union' ? `(${text})` : text,
    )
    .join(` ${operator} `);
  return { text, binding: isUnion ? 'union' : 'intersection' };
};

/**
 * The TypeScript type valibot infers for the schema `renderValibot` emits for
 * a node. A recursive constant annotates its `v.lazy` getter with it, because
 * TypeScript can't infer the type of a constant that reads itself.
 */
export const renderValibotType = (
  input: ValibotNode,
  {
    direction,
    exactOptional = false,
    declared,
    outputNames,
    readonlyRefs = new Set(),
  }: TypeRenderOptions,
): string => {
  const isOutput = direction === 'output';
  const infer = isOutput ? 'v.InferOutput' : 'v.InferInput';

  const renderEntries = (entries: ValibotEntry[]): TypeText => {
    if (entries.length === 0) return atom('{}');
    const lines = entries.map(({ key, value }) => {
      const hasDefault = value.defaultValue !== undefined;
      // A default fills the key in the output.
      const isOptional = hasDefault ? !isOutput : value.optional;
      const isReadonly = isOutput && hasReadonlyPipe(value, readonlyRefs);
      const extra = isOptional && !exactOptional ? ['undefined'] : [];
      const type = withNull(value, extra, false);
      return `  ${isReadonly ? 'readonly ' : ''}${renderKey(key)}${isOptional ? '?' : ''}: ${type.text};`;
    });
    return atom(`{\n${lines.join('\n')}\n}`);
  };

  const renderSchema = (
    { schema, actions }: ValibotNode,
    inIntersection: boolean,
  ): TypeText => {
    // The transforms run after every check, so the last one is the output.
    if (isOutput) {
      const transformed = actions.flatMap((action) => {
        if (action.kind === 'decode') return [atom(action.output)];
        // `renderValibot` leaves the date transform out of an intersection.
        if (action.kind === 'toDate' && !inIntersection) return [atom('Date')];
        return [];
      });
      const last = transformed.at(-1);
      if (last) return last;
    }

    switch (schema.kind) {
      case 'never':
      case 'unknown':
      case 'string':
      case 'number':
      case 'boolean':
      case 'null': {
        return atom(schema.kind);
      }
      case 'file': {
        // A component constant named `File` declares a type of that name.
        return atom('globalThis.File');
      }
      case 'literal': {
        return atom(schema.value);
      }
      case 'picklist': {
        return join(schema.values.map(atom), '|');
      }
      case 'array': {
        const items = `${arrayItem(render(schema.item, false))}[]`;
        const isReadonly =
          isOutput && actions.some((action) => action.kind === 'readonly');
        return isReadonly
          ? { text: `readonly ${items}`, binding: 'operator' }
          : atom(items);
      }
      case 'record': {
        const isReadonly =
          isOutput && hasReadonlyPipe(schema.value, readonlyRefs);
        const value = render(schema.value, false).text;
        return atom(
          `{ ${isReadonly ? 'readonly ' : ''}[key: string]: ${value} }`,
        );
      }
      case 'object': {
        const entries = renderEntries(schema.entries);
        return schema.mode === 'looseObject'
          ? join([entries, atom('{ [key: string]: unknown }')], '&')
          : entries;
      }
      case 'objectWithRest': {
        const rest = render(schema.rest, false).text;
        return join(
          [renderEntries(schema.entries), atom(`{ [key: string]: ${rest} }`)],
          '&',
        );
      }
      case 'union': {
        return join(
          schema.members.map((member) => render(member, inIntersection)),
          '|',
        );
      }
      case 'variant': {
        return join(
          schema.options.map((option) => render(option, inIntersection)),
          '|',
        );
      }
      case 'intersect': {
        // As in `renderValibot`, a lone member is not an intersection member.
        const isMember = schema.members.length > 1 || inIntersection;
        return join(
          schema.members.map((member) => render(member, isMember)),
          '&',
        );
      }
      case 'ref': {
        const inputType = declared.get(schema.name);
        if (inputType === undefined) {
          return atom(`${infer}<typeof ${schema.name}>`);
        }
        return atom(
          isOutput ? (outputNames?.get(schema.name) ?? schema.name) : inputType,
        );
      }
    }
  };

  // The type of a node, its null, and `extra` members such as the
  // `undefined` of an optional key.
  const withNull = (
    node: ValibotNode,
    extra: string[],
    inIntersection: boolean,
  ): TypeText =>
    join(
      [
        renderSchema(node, inIntersection),
        ...(node.nullable ? [atom('null')] : []),
        ...extra.map(atom),
      ],
      '|',
    );

  // A node outside an object entry, where optional means `T | undefined`. A
  // default fills it in the output.
  const render = (node: ValibotNode, inIntersection: boolean): TypeText => {
    const hasDefault = node.defaultValue !== undefined;
    const acceptsUndefined = hasDefault ? !isOutput : node.optional;
    return withNull(
      node,
      acceptsUndefined ? ['undefined'] : [],
      inIntersection,
    );
  };

  return render(input, false).text;
};
