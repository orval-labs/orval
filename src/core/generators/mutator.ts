import { Mutator } from '../../types';
import { GetterBody } from '../../types/getters';
import { dynamicImport } from '../../utils/imports';
import { isString } from '../../utils/is';

export const generateMutator = ({
  workspace,
  body,
  mutator,
}: {
  workspace: string;
  body: GetterBody;
  mutator?: Mutator;
}) => {
  if (!mutator) {
    return '';
  }

  const type = `(url: string,${
    body.definition ? ` data: ${body.definition}, ` : ''
  } config?: object) => [string, ${
    body.definition ? `${body.definition} | undefined, ` : ''
  } object | undefined]`;

  const mutatorFn = isString(mutator)
    ? dynamicImport(mutator, workspace)
    : mutator;

  return `
    type Mutator = ${type}

    const mutator: Mutator = ${mutatorFn}\n`;
};
