import { keyword } from 'esutils';

import {
  EnumGeneration,
  NamingConvention,
  type OpenApiSchemaObject,
} from '../types';
import {
  conventionName,
  escape,
  isNumeric,
  isString,
  jsStringEscape,
  sanitize,
} from '../utils';

/** Bridge type for enum values from AnyOtherAttribute-infected schema extensions */
type SchemaEnumValue = string | number | boolean | null;

/**
 * Map of special characters to semantic word replacements.
 *
 * Applied before naming convention transforms (PascalCase, camelCase, …) so
 * that characters which would otherwise be stripped still contribute a unique
 * segment to the generated key.  Without this, values like "created_at" and
 * "-created_at" both PascalCase to "CreatedAt", silently overwriting one
 * another in the generated const/enum object.
 *
 * Only characters that appear as leading/trailing modifiers in real-world
 * OpenAPI enums are mapped — the list is intentionally conservative to avoid
 * changing output for schemas that don't hit collisions.
 */
const ENUM_SPECIAL_CHARACTER_MAP: Record<string, string> = {
  '-': 'minus',
  '+': 'plus',
};

/**
 * Replace special characters with semantic words (plus an underscore separator)
 * so that naming convention transforms (PascalCase, etc.) produce unique keys.
 *
 * The trailing underscore acts as a word boundary so that PascalCase treats the
 * replacement as a separate word: "-created_at" → "minus_created_at" → "MinusCreatedAt".
 */
function replaceSpecialCharacters(key: string): string {
  let result = '';
  for (const char of key) {
    const replacement = ENUM_SPECIAL_CHARACTER_MAP[char];
    result += replacement ? replacement + '_' : char;
  }
  return result;
}

export function getEnumNames(schemaObject: OpenApiSchemaObject | undefined) {
  const names = (schemaObject?.['x-enumNames'] ??
    schemaObject?.['x-enumnames'] ??
    schemaObject?.['x-enum-varnames']) as
    | string[]
    | Record<string, string>
    | undefined;

  if (!names) return;

  if (Array.isArray(names)) {
    return names.map((name: string) => jsStringEscape(name));
  }

  // Object/Map format: keys correspond to enum values, values are the names.
  // Convert to an array ordered by the schema's enum values.
  if (typeof names === 'object') {
    const enumValues = (schemaObject?.enum ?? []) as SchemaEnumValue[];
    return enumValues.map((enumVal) => {
      const key = String(enumVal);
      return key in names ? jsStringEscape(names[key]) : undefined;
    });
  }

  return;
}

export function getEnumDescriptions(
  schemaObject: OpenApiSchemaObject | undefined,
) {
  const descriptions = (schemaObject?.['x-enumDescriptions'] ??
    schemaObject?.['x-enumdescriptions'] ??
    schemaObject?.['x-enum-descriptions']) as
    | string[]
    | Record<string, string>
    | undefined;

  if (!descriptions) return;

  if (Array.isArray(descriptions)) {
    return descriptions.map((description: string) =>
      jsStringEscape(description),
    );
  }

  // Object/Map format: keys correspond to enum values, values are the descriptions.
  // Convert to an array ordered by the schema's enum values.
  if (typeof descriptions === 'object') {
    const enumValues = (schemaObject?.enum ?? []) as SchemaEnumValue[];
    return enumValues.map((enumVal) => {
      const key = String(enumVal);
      return key in descriptions
        ? jsStringEscape(descriptions[key])
        : undefined;
    });
  }

  return;
}

export function getEnum(
  value: string,
  enumName: string,
  names: (string | undefined)[] | undefined,
  enumGenerationType: EnumGeneration,
  descriptions?: (string | undefined)[],
  enumNamingConvention?: NamingConvention,
) {
  if (enumGenerationType === EnumGeneration.CONST)
    return getTypeConstEnum(
      value,
      enumName,
      names,
      descriptions,
      enumNamingConvention,
    );
  if (enumGenerationType === EnumGeneration.ENUM)
    return getNativeEnum(value, enumName, names, enumNamingConvention);
  return getUnion(value, enumName);
}

const getTypeConstEnum = (
  value: string,
  enumName: string,
  names?: (string | undefined)[],
  descriptions?: (string | undefined)[],
  enumNamingConvention?: NamingConvention,
) => {
  let enumValue = `export type ${enumName} = typeof ${enumName}[keyof typeof ${enumName}]`;

  if (value.endsWith(' | null')) {
    value = value.replace(' | null', '');
    enumValue += ' | null';
  }

  enumValue += ';\n';

  const implementation = getEnumImplementation(
    value,
    names,
    descriptions,
    enumNamingConvention,
  );

  enumValue += '\n\n';

  enumValue += `export const ${enumName} = {\n${implementation}} as const;\n`;

  return enumValue;
};

/**
 * Derive the object/enum key for a single enum value.
 *
 * Handles numeric prefixes, sanitization, and optional naming convention
 * transforms.  When `disambiguate` is true, special characters (-/+) are
 * replaced with semantic words before the convention transform to prevent
 * key collisions.
 */
function deriveEnumKey(
  val: string,
  enumNamingConvention?: NamingConvention,
  disambiguate = false,
): string {
  let key = val.startsWith("'") ? val.slice(1, -1) : val;

  if (isNumeric(key)) {
    key = toNumberKey(key);
  }

  if (key.length > 1) {
    key = sanitize(key, {
      whitespace: '_',
      underscore: true,
      dash: true,
      special: true,
    });
  }

  if (enumNamingConvention) {
    if (disambiguate) {
      key = replaceSpecialCharacters(key);
    }
    key = conventionName(key, enumNamingConvention);
  }

  return key;
}

export function getEnumImplementation(
  value: string,
  names?: (string | undefined)[],
  descriptions?: (string | undefined)[],
  enumNamingConvention?: NamingConvention,
) {
  // empty enum or null-only enum
  if (value === '') return '';

  const uniqueValues = [...new Set(value.split(' | '))];

  // Check whether the naming convention produces duplicate keys.
  // Only apply special-character disambiguation when it does,
  // so that existing output is preserved for non-colliding enums.
  const disambiguate =
    !!enumNamingConvention &&
    new Set(uniqueValues.map((v) => deriveEnumKey(v, enumNamingConvention)))
      .size < uniqueValues.length;

  let result = '';
  for (const [index, val] of uniqueValues.entries()) {
    const name = names?.[index];
    const description = descriptions?.[index];
    const comment = description ? `  /** ${description} */\n` : '';

    if (name) {
      result +=
        comment +
        `  ${keyword.isIdentifierNameES5(name) ? name : `'${name}'`}: ${val},\n`;
      continue;
    }

    const key = deriveEnumKey(val, enumNamingConvention, disambiguate);

    result +=
      comment +
      `  ${keyword.isIdentifierNameES5(key) ? key : `'${key}'`}: ${val},\n`;
  }
  return result;
}

const getNativeEnum = (
  value: string,
  enumName: string,
  names?: (string | undefined)[],
  enumNamingConvention?: NamingConvention,
) => {
  const enumItems = getNativeEnumItems(value, names, enumNamingConvention);
  const enumValue = `export enum ${enumName} {\n${enumItems}\n}`;

  return enumValue;
};

const getNativeEnumItems = (
  value: string,
  names?: (string | undefined)[],
  enumNamingConvention?: NamingConvention,
) => {
  if (value === '') return '';

  const uniqueValues = [...new Set(value.split(' | '))];

  const disambiguate =
    !!enumNamingConvention &&
    new Set(uniqueValues.map((v) => deriveEnumKey(v, enumNamingConvention)))
      .size < uniqueValues.length;

  let result = '';
  for (const [index, val] of uniqueValues.entries()) {
    const name = names?.[index];
    if (name) {
      result += `  ${keyword.isIdentifierNameES5(name) ? name : `'${name}'`}= ${val},\n`;
      continue;
    }

    const key = deriveEnumKey(val, enumNamingConvention, disambiguate);

    result += `  ${keyword.isIdentifierNameES5(key) ? key : `'${key}'`}= ${val},\n`;
  }
  return result;
};

const toNumberKey = (value: string) => {
  if (value.startsWith('-')) {
    return `NUMBER_MINUS_${value.slice(1)}`;
  }
  if (value.startsWith('+')) {
    return `NUMBER_PLUS_${value.slice(1)}`;
  }
  return `NUMBER_${value}`;
};

const getUnion = (value: string, enumName: string) => {
  return `export type ${enumName} = ${value};`;
};

interface CombinedEnumInput {
  value: string;
  isRef: boolean;
  schema: OpenApiSchemaObject | undefined;
}

interface CombinedEnumValue {
  value: string;
  valueImports: string[];
  hasNull: boolean;
}

export function getEnumUnionFromSchema(
  schema: OpenApiSchemaObject | undefined,
) {
  if (!schema?.enum) return '';
  const schemaEnum = schema.enum as SchemaEnumValue[];
  return schemaEnum
    .filter((val): val is Exclude<SchemaEnumValue, null> => val !== null)
    .map((val) => (isString(val) ? `'${escape(val)}'` : String(val)))
    .join(' | ');
}

const stripNullUnion = (value: string) =>
  value.replaceAll(/\s*\|\s*null/g, '').trim();

const isSpreadableEnumRef = (
  schema: OpenApiSchemaObject | undefined,
  refName: string,
) => {
  if (!schema?.enum || !refName) return false;
  if (!getEnumUnionFromSchema(schema)) return false;
  const type = schema.type as string | string[] | undefined;
  if (type === 'boolean' || (Array.isArray(type) && type.includes('boolean'))) {
    return false;
  }
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(refName);
};

const buildInlineEnum = (
  schema: OpenApiSchemaObject | undefined,
  enumValue?: string,
) => {
  const names = getEnumNames(schema);
  const descriptions = getEnumDescriptions(schema);
  const unionValue = enumValue ?? getEnumUnionFromSchema(schema);
  return getEnumImplementation(unionValue, names, descriptions);
};

export function getCombinedEnumValue(
  inputs: CombinedEnumInput[],
): CombinedEnumValue {
  const valueImports: string[] = [];
  const hasNull = inputs.some((input) => {
    if (input.value.includes('| null')) return true;
    const schema = input.schema;
    if (!schema) return false;
    if (schema.nullable === true) return true;
    if (Array.isArray(schema.type) && schema.type.includes('null')) return true;
    const schemaEnum = schema.enum as SchemaEnumValue[] | undefined;
    // eslint-disable-next-line unicorn/no-null -- OpenAPI enum values include literal null
    return schemaEnum?.includes(null) ?? false;
  });

  const addValueImport = (name: string) => {
    if (!valueImports.includes(name)) {
      valueImports.push(name);
    }
  };

  if (inputs.length === 1) {
    const input = inputs[0];
    if (input.isRef) {
      const refName = stripNullUnion(input.value);
      if (isSpreadableEnumRef(input.schema, refName)) {
        addValueImport(refName);
        return { value: refName, valueImports, hasNull };
      }
      return {
        value: `{${buildInlineEnum(input.schema)}} as const`,
        valueImports,
        hasNull,
      };
    }

    return {
      value: `{${buildInlineEnum(input.schema, stripNullUnion(input.value))}} as const`,
      valueImports,
      hasNull,
    };
  }

  const enums = inputs
    .map((input) => {
      if (input.isRef) {
        const refName = stripNullUnion(input.value);
        if (isSpreadableEnumRef(input.schema, refName)) {
          addValueImport(refName);
          return `...${refName},`;
        }
        return buildInlineEnum(input.schema);
      }

      return buildInlineEnum(input.schema, stripNullUnion(input.value));
    })
    .join('');

  return { value: `{${enums}} as const`, valueImports, hasNull };
}
