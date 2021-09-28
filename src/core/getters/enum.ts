import { keyword } from 'esutils';
import { sanitize } from '../../utils/string';

export const getEnum = (value: string, type: string, enumName: string) => {
  let enumValue = `export type ${enumName} = ${value};\n`;

  const implementation = [...new Set(value.split(' | '))].reduce((acc, val) => {
    const isTypeNumber = type === 'number';
    const isNumber = !Number.isNaN(Number(val.slice(1, -1)));
    const key =
      isNumber || isTypeNumber
        ? toNumberKey(isTypeNumber ? val.toString() : val.slice(1, -1))
        : sanitize(val, { underscore: '_', whitespace: '_' });

    return (
      acc +
      `  ${
        keyword.isIdentifierNameES5(key) ? key : `'${key}'`
      }: ${val} as ${enumName},\n`
    );
  }, '');

  enumValue += `\n\nexport const ${enumName} = {\n${implementation}};\n`;

  return enumValue;
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
