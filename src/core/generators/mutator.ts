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

  const type = `<T>(url: string,${
    body.definition ? ` data: ${body.definition}, ` : ''
  } config?: T) => [string, ${
    body.definition ? `${body.definition} | undefined, ` : ''
  } T | undefined]`;

  const mutatorFn = isString(mutator)
    ? dynamicImport(mutator, workspace)
    : mutator;

  return `
    type Mutator = ${type}

    const mutator: Mutator = ${mutatorFn}\n`;
};
