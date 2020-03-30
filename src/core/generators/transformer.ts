import { OperationOptions } from '../../types';
import { GetterBody } from '../../types/getters';
import { dynamicImport } from '../../utils/imports';

export const generateTransformer = ({
  body,
  overrideOperation,
}: {
  body: GetterBody;
  overrideOperation?: OperationOptions;
}) => {
  const transformer = overrideOperation?.transformer
    ? dynamicImport(overrideOperation.transformer)
    : undefined;

  if (!transformer) {
    return '';
  }

  const type = `(url: string,${
    body.definition ? ` data: ${body.definition}, ` : ''
  } config?: AxiosRequestConfig) => [string, ${
    body.definition ? `${body.definition} | undefined, ` : ''
  } AxiosRequestConfig | undefined]`;

  return `
    type Transformer = ${type}

    const transformer: Transformer = ${transformer}\n`;
};
