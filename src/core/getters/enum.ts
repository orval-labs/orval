import { upper } from '../../utils/case';
import { sanitize } from '../../utils/string';

export const getEnum = (value: string, type: string, enumName: string) => {
  let enumValue = `export type ${enumName} = ${value};\n`;

  const implementation = value.split(' | ').reduce((acc, val) => {
    const key =
      type === 'number'
        ? `${upper(type)}_${val}`
        : sanitize(val, { underscore: '_', whitespace: '_' });
    const startWithNumber = !Number.isNaN(+key[0]);

    return (
      acc + `  ${startWithNumber ? `'${key}'` : key}: ${val} as ${enumName},\n`
    );
  }, '');

  enumValue += `\n\nexport const ${enumName} = {\n${implementation}};\n`;

  return enumValue;
};
