import {
  type ContextSpec,
  getModuleIdentifiers,
  getReferencedFormatTypeImports,
  type NormalizedFormatTypeConfig,
  type NormalizedOutputOptions,
  withInlineImports,
} from '@orval/core';

import { generateValibotModelTypeChecks } from './model-type-checks';
import {
  generateValibotComponentConsts,
  renderValibotComponents,
} from './reusable-schemas';

const VALIBOT_IMPORT = "import * as v from 'valibot';";

interface ValibotSchemasInput {
  spec: ContextSpec['spec'];
  target: string;
}

/**
 * The component constants for the module holding the operations, with the
 * imports they need that `precedingContent`, the part of the module written
 * before them, does not have already. With `override.modelTypeChecks`, the
 * type-only checks of the constants against the models follow them. Their
 * helper names avoid the constants and what the module declares or imports,
 * in `precedingContent` and in `followingContent`, the part written after.
 */
export const generateValibotSchemasInline = (
  builder: ValibotSchemasInput,
  output: NormalizedOutputOptions,
  includeImport: boolean,
  precedingContent = '',
  followingContent = '',
): string => {
  const context: ContextSpec = {
    spec: builder.spec,
    target: builder.target,
    workspace: '',
    output,
  };
  const consts = generateValibotComponentConsts(context);
  const rendered = renderValibotComponents(consts);
  if (rendered === '') return '';
  const pick = (config: NormalizedFormatTypeConfig) => [config.decodeImport];
  // The names the block must not reuse: the constants and their types, what
  // the rest of the module imports or declares, and the decode functions the
  // constants make the module import.
  const taken = new Set([
    ...consts.flatMap(({ name, types }) => [
      name,
      ...(types ? [types.outputName, types.inputName] : []),
    ]),
    ...getModuleIdentifiers(`${precedingContent}\n${followingContent}`),
    ...getReferencedFormatTypeImports(rendered, output.override, pick).map(
      ({ name, alias }) => alias ?? name,
    ),
  ]);
  const { importLine, block } = generateValibotModelTypeChecks(
    context,
    consts,
    taken,
  );
  return withInlineImports({
    components: rendered,
    // Written after the constants and not scanned for the decode functions:
    // the block holds comments and type names, not calls.
    appendix: block,
    output,
    precedingContent,
    pick,
    libraryImport: () =>
      [includeImport ? VALIBOT_IMPORT : '', importLine]
        .filter(Boolean)
        .join('\n'),
  });
};
