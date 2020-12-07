import { uniq, uniqWith } from 'lodash';
import { GeneratorMutator } from '../../types/generator';
import { camel } from '../../utils/case';
import { isString } from '../../utils/is';

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
  const imports = uniqWith(
    mutators,
    (a, b) => a.name === b.name && a.default === b.default,
  )
    .map((mutator) => {
      const importDefault = mutator.default
        ? mutator.name
        : `{ ${mutator.name} }`;

      return `import ${importDefault} from '${oneMore ? '../' : ''}${
        mutator.path
      }'`;
    })
    .join('\n');

  return imports ? imports + '\n' : '';
};

export const addDependency = ({
  implementation,
  exports,
  dependency,
}: {
  implementation: string;
  exports: string[] | string;
  dependency: string;
}) => {
  if (isString(exports)) {
    if (!implementation.includes(exports)) {
      return undefined;
    }
    return `import ${exports} from '${dependency}'`;
  }

  const toAdds = exports.filter((e) => implementation.includes(e));

  if (!toAdds.length) {
    return undefined;
  }

  return `import {\n  ${uniq(toAdds).join(',\n  ')}\n} from '${dependency}'`;
};

export const generateDependencyImports = (
  implementation: string,
  imports: {
    exports: string[] | string;
    dependency: string;
  }[],
): string => {
  const dependencies = imports
    .map((dep) => addDependency({ ...dep, implementation }))
    .filter(Boolean)
    .join('\n');

  return dependencies ? dependencies + '\n' : '';
};
