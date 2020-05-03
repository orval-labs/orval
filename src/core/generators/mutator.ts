import { GetterBody } from '../../types/getters';
import { dynamicImport } from '../../utils/imports';

export const generateMutator = ({
  workspace,
  body,
  mutator,
}: {
  workspace: string;
  body: GetterBody;
  mutator?: string;
}) => {
  if (!mutator) {
    return '';
  }

  const type = `(url: string,${
    body.definition ? ` data: ${body.definition}, ` : ''
  } config?: AxiosRequestConfig) => [string, ${
    body.definition ? `${body.definition} | undefined, ` : ''
  } AxiosRequestConfig | undefined]`;

  return `
    type Mutator = ${type}

    const mutator: Mutator = ${dynamicImport(mutator, workspace)}\n`;
};
