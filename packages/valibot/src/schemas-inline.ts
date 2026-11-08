import {
  type ContextSpec,
  escapeRegExp,
  generateImports,
  getReferencedFormatTypeImports,
  type NormalizedOutputOptions,
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
  const isImported = (name: string) =>
    new RegExp(
      String.raw`^import\s[^;]*?(?<![\w$])${escapeRegExp(name)}(?![\w$])[^;]*?\sfrom\s`,
      'm',
    ).test(precedingContent);
  const decodeImports = generateImports({
    imports: getReferencedFormatTypeImports(
      components,
      output.override,
      (config) => [config.decodeImport],
    ).filter(({ name }) => !isImported(name)),
  });
  const imports = [includeImport ? VALIBOT_IMPORT : '', decodeImports]
    .filter(Boolean)
    .join('\n');
  return `${imports ? `${imports}\n\n` : ''}${components}\n\n`;
};
