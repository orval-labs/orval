import { keyword } from 'esutils';
import { isNumeric, sanitize } from '../utils';

export const getEnum = (value: string, enumName: string, names?: string[]) => {
  let enumValue = `export type ${enumName} = typeof ${enumName}[keyof typeof ${enumName}];\n`;

  const implementation = getEnumImplementation(value, names);

  enumValue += `\n\n`;

  enumValue += '// eslint-disable-next-line @typescript-eslint/no-redeclare\n';

  enumValue += `export const ${enumName} = {\n${implementation}} as const;\n`;

  return enumValue;
};

export const getEnumImplementation = (value: string, names?: string[]) => {
  return [...new Set(value.split(' | '))].reduce((acc, val, index) => {
    // nullable value shouldn't be in the enum implementation
    if (val === 'null') return acc;

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

const toNumberKey = (value: string) => {
  if (value[0] === '-') {
    return `NUMBER_MINUS_${value.slice(1)}`;
  }
  if (value[0] === '+') {
    return `NUMBER_PLUS_${value.slice(1)}`;
  }
  return `NUMBER_${value}`;
};
