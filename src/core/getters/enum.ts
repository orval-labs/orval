import { keyword } from 'esutils';
import { sanitize } from '../../utils/string';

export const getEnum = (value: string, type: string, enumName: string) => {
  let enumValue = `export type ${enumName} = typeof ${enumName}[keyof typeof ${enumName}];\n`;

  const implementation = getEnumImplementation(value, type);

  enumValue += `\n\n`;

  enumValue += '// eslint-disable-next-line @typescript-eslint/no-redeclare\n';

  enumValue += `export const ${enumName} = {\n${implementation}} as const;\n`;

  return enumValue;
};

export const getEnumImplementation = (value: string, type: string) => {
  return [...new Set(value.split(' | '))].reduce((acc, val) => {
    // nullable value shouldn't be in the enum implementation
    if (val === 'null') return acc;
    const isTypeNumber = type === 'number';

    const valueWithoutQuotes = isTypeNumber ? val.toString() : val.slice(1, -1);
    const isNumber = isTypeNumber || !Number.isNaN(Number(valueWithoutQuotes));

    let key: string;
    if (isNumber) {
      key = toNumberKey(valueWithoutQuotes);
    } else {
      key = sanitize(valueWithoutQuotes, {
        underscore: '_',
        whitespace: '_',
        dash: '-',
      });

      /*
        Potentially sanitize can strip to much from a value
        For example:
        sanitize("привет, мир!") -> "_"
        sanitize("❤") -> ""
        In that case it's more reasonable to return a full unchanged value
        which will be later surrounded with quotes
       */
      if (key.length < valueWithoutQuotes.length) {
        key = valueWithoutQuotes;
      }
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
