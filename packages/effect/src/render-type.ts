import { isString } from '@orval/core';

import type { EffectValidationSchemaDefinition } from '.';
import {
  admitsNull,
  fieldsOf,
  isDefinition,
  isIdentifierPath,
  membersOf,
} from './refs';

type Definition = EffectValidationSchemaDefinition;

interface RenderTypeOptions {
  direction: 'type' | 'encoded';
  exactOptional: boolean;
  isEffectV4: boolean;
  // The constants on a cycle, with the name of their encoded type. Their
  // types are declared, so a reference reads them by name.
  declared: ReadonlyMap<string, string>;
}

interface Rendered {
  text: string;
  // Whether a struct property of this type is declared with `?`.
  optionalKey: boolean;
}

const STRING_LITERAL = /'(?:[^'\\]|\\.)*'/g;

const parenthesize = (type: string): string =>
  type.includes(' | ') ? `(${type})` : type;

// One struct an allOf merges to: its keys by name, so a later member replaces
// the key of an earlier one, and whether it accepts other keys.
interface Variant {
  fields: ReadonlyMap<string, string>;
  open: boolean;
}

const OPEN_SIGNATURE = '{ readonly [x: string]: unknown }';

// What a member adds to a merge besides its keys.
const NOT_MERGED: ReadonlySet<string> = new Set([
  'describe',
  'default',
  'encodedDefault',
  'nullable',
  'nullish',
]);

const structText = (fields: Iterable<string>, open: boolean): string => {
  const list = [...fields];
  const struct = list.length > 0 ? `{ ${list.join('; ')} }` : '{}';
  return open ? `${struct} & ${OPEN_SIGNATURE}` : struct;
};

/**
 * The TypeScript type a definition decodes to (`type`) or accepts (`encoded`),
 * written out so a constant on a cycle can name it.
 */
export const renderEffectType = (
  definition: Definition,
  { direction, exactOptional, isEffectV4, declared }: RenderTypeOptions,
): string => {
  const encoded = direction === 'encoded';

  // The type of a schema declared elsewhere, read off its constant.
  const typeOfSchema = (expression: unknown): string => {
    if (!isString(expression) || !isIdentifierPath(expression)) {
      return 'unknown';
    }
    const accessor = encoded
      ? `${isEffectV4 ? 'Codec' : 'Schema'}.Encoded`
      : 'Schema.Type';
    return `S.${accessor}<typeof ${expression}>`;
  };

  const base = (fn: string, arg: unknown): string | undefined => {
    switch (fn) {
      case 'never':
      case 'string':
      case 'boolean':
      case 'null':
      case 'unknown':
      case 'any': {
        return fn;
      }
      case 'number':
      case 'integer': {
        return 'number';
      }
      case 'date': {
        return encoded ? 'string' : 'Date';
      }
      case 'formatSchema': {
        return typeOfSchema(arg);
      }
      case 'literal': {
        return String(arg);
      }
      case 'enum': {
        return isString(arg)
          ? (arg.match(STRING_LITERAL) ?? []).join(' | ') || 'never'
          : 'never';
      }
      case 'instanceof': {
        return String(arg);
      }
      case 'fileOrString': {
        return 'File | string';
      }
      case 'array': {
        const item = render(arg, false).text;
        // An array of `S.Never` is `S.Tuple()`, which only accepts `[]`.
        const isTuple =
          isDefinition(arg) && arg.functions.some(([fn]) => fn === 'never');
        return isTuple && item === 'never'
          ? 'readonly []'
          : `ReadonlyArray<${item}>`;
      }
      case 'tuple': {
        return `readonly [${membersOf(arg)
          .map((member) => render(member, false).text)
          .join(', ')}]`;
      }
      case 'object':
      case 'strictObject':
      case 'looseObject': {
        return structText(fieldTexts(arg).values(), fn === 'looseObject');
      }
      case 'additionalProperties': {
        return `{ readonly [x: string]: ${render(arg, false).text} }`;
      }
      case 'oneOf':
      case 'anyOf': {
        return (
          membersOf(arg)
            .map((member) => render(member, false).text)
            .join(' | ') || 'never'
        );
      }
      case 'allOf': {
        const members = membersOf(arg);
        if (members.length === 0) return 'unknown';
        if (!isEffectV4) {
          return members
            .map((member) => parenthesize(render(member, false).text))
            .join(' & ');
        }
        if (members.length === 1) return render(members[0], false).text;
        // Effect 4 merges the members' fields, so a later key replaces an
        // earlier one. The merge admits `null` when every member does.
        const merged = mergeVariants(members)
          .map(({ fields, open }) => structText(fields.values(), open))
          .join(' | ');
        return members.every(admitsNull) ? `${merged} | null` : merged;
      }
      case 'ref': {
        const encodedName = isString(arg) ? declared.get(arg) : undefined;
        if (encodedName === undefined) return typeOfSchema(arg);
        return encoded ? encodedName : String(arg);
      }
      default: {
        return undefined;
      }
    }
  };

  const fieldTexts = (arg: unknown): Map<string, string> =>
    new Map(
      fieldsOf(arg).map(([key, field]) => {
        const { text, optionalKey } = render(field, true);
        return [
          key,
          `readonly ${JSON.stringify(key)}${optionalKey ? '?' : ''}: ${text}`,
        ];
      }),
    );

  // The structs a member merges as: each member of a bare union, without its
  // `null`, else itself. Anything else adds no key.
  const variantsOf = (member: Definition): Variant[] => {
    const functions = member.functions.filter(([fn]) => !NOT_MERGED.has(fn));
    const [fn, arg] = functions[0] ?? [];
    if (functions.length === 1) {
      if (fn === 'allOf') return mergeVariants(membersOf(arg));
      if (fn === 'oneOf' || fn === 'anyOf') {
        return membersOf(arg)
          .filter((alternative) => alternative.functions[0]?.[0] !== 'null')
          .flatMap(variantsOf);
      }
      if (fn === 'object' || fn === 'strictObject') {
        return [{ fields: fieldTexts(arg), open: false }];
      }
      if (fn === 'looseObject') {
        return [{ fields: fieldTexts(arg), open: true }];
      }
      if (
        fn === 'additionalProperties' &&
        isDefinition(arg) &&
        arg.functions.every(([value]) => value === 'unknown')
      ) {
        return [{ fields: new Map(), open: true }];
      }
    }
    return [{ fields: new Map(), open: false }];
  };

  const mergeVariants = (members: readonly Definition[]): Variant[] => {
    let merged: Variant[] = [{ fields: new Map(), open: false }];
    for (const member of members) {
      const sources = variantsOf(member);
      merged = merged.flatMap((target) =>
        sources.map((source) => ({
          fields: new Map([...target.fields, ...source.fields]),
          open: target.open || source.open,
        })),
      );
    }
    return merged;
  };

  const render = (value: unknown, asProperty: boolean): Rendered => {
    if (!isDefinition(value)) return { text: 'unknown', optionalKey: false };
    const { functions } = value;
    const has = (name: string) => functions.some(([fn]) => fn === name);
    const kind = functions
      .map(([fn, arg]) => base(fn, arg))
      .find((type) => type !== undefined);
    const type = kind ?? 'unknown';
    const nullable = has('nullable') || has('nullish');
    const text = nullable ? `${type} | null` : type;
    if (has('default') || has('encodedDefault')) {
      // A default fills a missing key, so only the encoded side may omit it.
      return encoded
        ? { text: `${text} | undefined`, optionalKey: asProperty }
        : { text, optionalKey: false };
    }
    if (has('optional') || has('nullish')) {
      return {
        text: asProperty && exactOptional ? text : `${text} | undefined`,
        optionalKey: asProperty,
      };
    }
    return { text, optionalKey: false };
  };

  return render(definition, false).text;
};
