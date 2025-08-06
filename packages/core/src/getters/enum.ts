import { keyword } from 'esutils';
import { SchemaObject } from 'openapi3-ts/oas30';
import { EnumGeneration, NamingConvention } from '../types';
import { conventionName, isNumeric, sanitize } from '../utils';

export const getEnumNames = (schemaObject: SchemaObject | undefined) => {
  return (
    schemaObject?.['x-enumNames'] ||
    schemaObject?.['x-enumnames'] ||
    schemaObject?.['x-enum-varnames']
  );
};

export const getEnumDescriptions = (schemaObject: SchemaObject | undefined) => {
  return (
    schemaObject?.['x-enumDescriptions'] ||
    schemaObject?.['x-enumdescriptions'] ||
    schemaObject?.['x-enum-descriptions']
  );
};

export const getEnum = (
  value: string,
  enumName: string,
  names: string[] | undefined,
  enumGenerationType: EnumGeneration,
  descriptions?: string[],
  enumNamingConvention?: NamingConvention,
) => {
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
};

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

  enumValue += '// eslint-disable-next-line @typescript-eslint/no-redeclare\n';

  enumValue += `export const ${enumName} = {\n${implementation}} as const;\n`;

  return enumValue;
};

export const getEnumImplementation = (
  value: string,
  names?: string[],
  descriptions?: string[],
  enumNamingConvention?: NamingConvention,
) => {
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
};

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
  if (value[0] === '-') {
    return `NUMBER_MINUS_${value.slice(1)}`;
  }
  if (value[0] === '+') {
    return `NUMBER_PLUS_${value.slice(1)}`;
  }
  return `NUMBER_${value}`;
};

const getUnion = (value: string, enumName: string) => {
  return `export type ${enumName} = ${value};`;
};
