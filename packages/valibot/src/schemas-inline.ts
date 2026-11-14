import {
  type ContextSpec,
  type NormalizedOutputOptions,
  withInlineImports,
} from '@orval/core';

import { generateValibotComponents } from './reusable-schemas';

const VALIBOT_IMPORT = "import * as v from 'valibot';";

interface ValibotSchemasInput {
  spec: ContextSpec['spec'];
  target: string;
}

/**
 * The component constants for the module holding the operations, with the
 * `formatType` `decode` imports they reference that `precedingContent`, the
 * part of the module written before them, does not import already.
 */
export const generateValibotSchemasInline = (
  builder: ValibotSchemasInput,
  output: NormalizedOutputOptions,
  includeImport: boolean,
  precedingContent = '',
): string => {
  const components = generateValibotComponents({
    spec: builder.spec,
    target: builder.target,
    workspace: '',
    output,
  });
  if (components === '') return '';
  return withInlineImports({
    components,
    output,
    precedingContent,
    pick: (config) => [config.decodeImport],
    libraryImport: () => (includeImport ? VALIBOT_IMPORT : ''),
  });
};
