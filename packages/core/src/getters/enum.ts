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

export function getEnumNames(schemaObject: OpenApiSchemaObject | undefined) {
  const names =
    schemaObject?.['x-enumNames'] ??
    schemaObject?.['x-enumnames'] ??
    schemaObject?.['x-enum-varnames'];

  if (!names) return;

  return (names as string[]).map((name: string) => jsStringEscape(name));
}

export function getEnumDescriptions(
  schemaObject: OpenApiSchemaObject | undefined,
) {
  const descriptions =
    schemaObject?.['x-enumDescriptions'] ??
    schemaObject?.['x-enumdescriptions'] ??
    schemaObject?.['x-enum-descriptions'];

  if (!descriptions) return;

  return (descriptions as string[]).map((description: string) =>
    jsStringEscape(description),
  );
}

export function getEnum(
  value: string,
  enumName: string,
  names: string[] | undefined,
  enumGenerationType: EnumGeneration,
  descriptions?: string[],
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
  if (enumGenerationType === EnumGeneration.UNION)
    return getUnion(value, enumName);
  throw new Error(`Invalid enumGenerationType: ${enumGenerationType}`);
}

const getTypeConstEnum = (
  value: string,
  enumName: string,
  names?: string[],
  descriptions?: string[],
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

export function getEnumImplementation(
  value: string,
  names?: string[],
  descriptions?: string[],
  enumNamingConvention?: NamingConvention,
) {
  // empty enum or null-only enum
  if (value === '') return '';

  return [...new Set(value.split(' | '))].reduce((acc, val, index) => {
    const name = names?.[index];
    const description = descriptions?.[index];
    const comment = description ? `  /** ${description} */\n` : '';

    if (name) {
      return (
        acc +
        comment +
        `  ${keyword.isIdentifierNameES5(name) ? name : `'${name}'`}: ${val},\n`
      );
    }

    let key = val.startsWith("'") ? val.slice(1, -1) : val;

    const isNumber = isNumeric(key);

    if (isNumber) {
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
      key = conventionName(key, enumNamingConvention);
    }

    return (
      acc +
      comment +
      `  ${keyword.isIdentifierNameES5(key) ? key : `'${key}'`}: ${val},\n`
    );
  }, '');
}

const getNativeEnum = (
  value: string,
  enumName: string,
  names?: string[],
  enumNamingConvention?: NamingConvention,
) => {
  const enumItems = getNativeEnumItems(value, names, enumNamingConvention);
  const enumValue = `export enum ${enumName} {\n${enumItems}\n}`;

  return enumValue;
};

const getNativeEnumItems = (
  value: string,
  names?: string[],
  enumNamingConvention?: NamingConvention,
) => {
  if (value === '') return '';

  return [...new Set(value.split(' | '))].reduce((acc, val, index) => {
    const name = names?.[index];
    if (name) {
      return (
        acc +
        `  ${keyword.isIdentifierNameES5(name) ? name : `'${name}'`}= ${val},\n`
      );
    }

    let key = val.startsWith("'") ? val.slice(1, -1) : val;

    const isNumber = isNumeric(key);

    if (isNumber) {
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
      key = conventionName(key, enumNamingConvention);
    }

    return (
      acc +
      `  ${keyword.isIdentifierNameES5(key) ? key : `'${key}'`}= ${val},\n`
    );
  }, '');
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

type CombinedEnumInput = {
  value: string;
  isRef: boolean;
  schema: OpenApiSchemaObject | undefined;
};

type CombinedEnumValue = {
  value: string;
  valueImports: string[];
  hasNull: boolean;
};

export function getEnumUnionFromSchema(
  schema: OpenApiSchemaObject | undefined,
) {
  if (!schema?.enum) return '';
  return schema.enum
    .filter((val) => val !== null)
    .map((val) => (isString(val) ? `'${escape(val)}'` : `${val}`))
    .join(' | ');
}

const stripNullUnion = (value: string) =>
  value.replace(/\s*\|\s*null/g, '').trim();

const isSpreadableEnumRef = (
  schema: OpenApiSchemaObject | undefined,
  refName: string,
) => {
  if (!schema?.enum || !refName) return false;
  if (!getEnumUnionFromSchema(schema)) return false;
  const type = schema.type;
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
    return schema.enum?.includes(null) ?? false;
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
