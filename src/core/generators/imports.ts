import { camel } from 'case';

export const generateImports = (
  imports: string[] = [],
  path: string = '.',
  pathOnly: boolean = false,
) => {
  if (pathOnly) {
    return `import {\n  ${imports.sort().join(',\n  ')}\n} from \'${path}\';\n`;
  }
  return imports
    .sort()
    .map((imp) => `import { ${imp} } from \'${path}/${camel(imp)}\';`)
    .join('\n');
};
