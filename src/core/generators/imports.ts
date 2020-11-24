import { uniqWith } from 'lodash';
import { GeneratorMutator } from '../../types/generator';
import { camel } from '../../utils/case';

export const generateImports = (
  imports: string[] = [],
  path: string = '.',
  pathOnly: boolean = false,
) => {
  if (!imports.length) {
    return '';
  }
  if (pathOnly) {
    return `import {\n  ${imports
      .sort()
      .join(',\n  ')},\n} from \'${path}\';\n`;
  }
  return imports
    .sort()
    .map((imp) => `import { ${imp} } from \'${path}/${camel(imp)}\';`)
    .join('\n');
};

export const generateMutatorImports = (
  mutators: GeneratorMutator[],
  oneMore?: boolean,
) => {
  return uniqWith(
    mutators,
    (a, b) => a.name === b.name && a.default === b.default,
  )
    .map((mutator) => {
      const importDefault = mutator.default
        ? mutator.name
        : `{ ${mutator.name} }`;

      return `import ${importDefault} from '${oneMore ? './.' : ''}${
        mutator.path
      }'`;
    })
    .join('\n');
};
