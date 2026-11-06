import type { ContextSpec, NormalizedOutputOptions } from '@orval/core';

import { generateValibotComponents } from './reusable-schemas';

const VALIBOT_IMPORT = "import * as v from 'valibot';";

interface ValibotSchemasInput {
  spec: ContextSpec['spec'];
  target: string;
}

/** The component constants for the module holding the operations. */
export const generateValibotSchemasInline = (
  builder: ValibotSchemasInput,
  output: NormalizedOutputOptions,
  includeImport: boolean,
): string => {
  const components = generateValibotComponents({
    spec: builder.spec,
    target: builder.target,
    workspace: '',
    output,
  });
  if (components === '') return '';
  return `${includeImport ? `${VALIBOT_IMPORT}\n\n` : ''}${components}\n\n`;
};
