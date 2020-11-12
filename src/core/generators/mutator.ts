import { Mutator } from '../../types';
import { GetterBody } from '../../types/getters';
import { dynamicImport } from '../../utils/imports';

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
    body.definition
      ? ` data: ${body.isBlob ? `FormData` : body.definition}, `
      : ''
  } config?: object) => [string, ${
    body.definition
      ? `${body.isBlob ? `FormData` : body.definition} | undefined, `
      : ''
  } object | undefined]`;

  const mutatorFn = dynamicImport(mutator, workspace);

  return `
    type Mutator = ${type}

    const mutator: Mutator = ${mutatorFn}\n`;
};
