import { keyword } from 'esutils';
import { SchemaObject } from 'openapi3-ts/dist/model/openapi30';
import { EnumGeneration } from '../types';
import { isNumeric, sanitize } from '../utils';

export const getEnumNames = (
  schemaObject: SchemaObject | undefined,
): string[] | undefined => {
  return (
    schemaObject?.['x-enumNames'] ||
    schemaObject?.['x-enumnames'] ||
    schemaObject?.['x-enum-varnames']
  );
};

export const getEnum = (
  value: string,
  enumName: string,
  names: string[] | undefined,
  enumGenerationType: EnumGeneration,
) => {
  if (enumGenerationType === EnumGeneration.CONST)
    return getTypeConstEnum(value, enumName, names);
  if (enumGenerationType === EnumGeneration.ENUM)
    return getNativeEnum(value, enumName, names);
  if (enumGenerationType === EnumGeneration.UNION)
    return getUnion(value, enumName);
  throw new Error(`Invalid enumGenerationType: ${enumGenerationType}`);
};

export const getEnumItems = (
  value: string,
  names: string[] | undefined,
  enumGenerationType: EnumGeneration,
) => {
  if (enumGenerationType === EnumGeneration.CONST)
    return getConstEnumItems(value, names);
  if (enumGenerationType === EnumGeneration.ENUM)
    return getNativeEnumItems(value, names);
  if (enumGenerationType === EnumGeneration.UNION) return value;
  return '';
};

export const getEnumDefinition = (
  enumValue: string,
  enumName: string,
  enumGenerationType: EnumGeneration,
) => {
  if (enumGenerationType === EnumGeneration.CONST)
    return `// eslint-disable-next-line @typescript-eslint/no-redeclare\nexport const ${enumName} = {${enumValue}} as const`;
  if (enumGenerationType === EnumGeneration.ENUM)
    return `export enum ${enumName} {${enumValue}}`;
  if (enumGenerationType === EnumGeneration.UNION)
    return `export type ${enumName} = ${enumValue}`;
  return '';
};

export const getEnumPropertyType = (
  enumName: string,
  enumGenerationType: EnumGeneration,
) => {
  if (enumGenerationType === EnumGeneration.CONST)
    return `typeof ${enumName}[keyof typeof ${enumName}]`;
  if (enumGenerationType === EnumGeneration.ENUM) return enumName;
  if (enumGenerationType === EnumGeneration.UNION) return enumName;
  return '';
};

const getTypeConstEnum = (
  value: string,
  enumName: string,
  names?: string[],
) => {
  let enumValue = `export type ${enumName} = typeof ${enumName}[keyof typeof ${enumName}]`;

  if (value.endsWith(' | null')) {
    value = value.replace(' | null', '');
    enumValue += ' | null';
  }

  enumValue += ';\n';

  const implementation = getConstEnumItems(value, names);

  enumValue += `\n\n`;

  enumValue += '// eslint-disable-next-line @typescript-eslint/no-redeclare\n';

  enumValue += `export const ${enumName} = {\n${implementation}} as const;\n`;

  return enumValue;
};

const getConstEnumItems = (value: string, names?: string[]) => {
  // empty enum or null-only enum
  if (value === '') return '';

  return [...new Set(value.split(' | '))].reduce((acc, val, index) => {
    const name = names?.[index];
    if (name) {
      return (
        acc +
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

    return (
      acc +
      `  ${keyword.isIdentifierNameES5(key) ? key : `'${key}'`}: ${val},\n`
    );
  }, '');
};

const getNativeEnum = (value: string, enumName: string, names?: string[]) => {
  const enumItems = getNativeEnumItems(value, names);
  const enumValue = `export enum ${enumName} {\n${enumItems}\n}`;

  return enumValue;
};

const getNativeEnumItems = (value: string, names?: string[]) => {
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
