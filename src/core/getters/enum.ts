import { keyword } from 'esutils';

export const getEnum = (value: string, type: string, enumName: string) => {
  let enumValue = `export type ${enumName} = typeof ${enumName}[keyof typeof ${enumName}];\n`;

  const implementation = getEnumImplementation(value, type);

  enumValue += `\n\n`;

  enumValue += '// eslint-disable-next-line @typescript-eslint/no-redeclare\n';

  enumValue += `export const ${enumName} = {\n${implementation}} as const;\n`;

  return enumValue;
};

const SPACE_REGEX = /[\s]/g;

export const getEnumImplementation = (value: string, type: string) => {
  return [...new Set(value.split(' | '))].reduce((acc, val) => {
    // nullable value shouldn't be in the enum implementation
    if (val === 'null') return acc;

    let key = val.startsWith("'") ? val.slice(1, -1) : val;

    const isNumber = !Number.isNaN(Number(key));

    if (isNumber) {
      key = toNumberKey(key);
    }

    if (SPACE_REGEX.test(key)) {
      key = key.replace(SPACE_REGEX, '_');
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
