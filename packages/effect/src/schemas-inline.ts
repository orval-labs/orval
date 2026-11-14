import {
  type ContextSpec,
  type GeneratorOperation,
  type NormalizedOutputOptions,
  withInlineImports,
} from '@orval/core';

import { generateEffectComponents } from './reusable-schemas';

interface EffectSchemasInput {
  spec: ContextSpec['spec'];
  operations: Record<string, Pick<GeneratorOperation, 'imports'>>;
  target: string;
}

/**
 * The component constants for the module holding the operations, with the
 * `effect` and `formatType` `schemaImport` imports they need that
 * `precedingContent`, the part of the module written before them, does not
 * import already.
 */
export const generateEffectSchemasInline = (
  builder: EffectSchemasInput,
  output: NormalizedOutputOptions,
  precedingContent = '',
): string => {
  // The component constants the operations import.
  const used = new Set(
    Object.values(builder.operations).flatMap(({ imports }) =>
      imports.flatMap(({ name, schemaName, values }) =>
        values && schemaName ? [name] : [],
      ),
    ),
  );
  const components = generateEffectComponents(
    {
      spec: builder.spec,
      target: builder.target,
      workspace: '',
      output,
    },
    used,
  );
  if (components === '') return '';
  return withInlineImports({
    components,
    output,
    precedingContent,
    pick: (config) => [config.effect?.schemaImport],
    libraryImport: (isImported) => {
      const names = [
        ...(isImported('S') ? [] : ['Schema as S']),
        ...(components.includes('Effect.succeed(') && !isImported('Effect')
          ? ['Effect']
          : []),
      ];
      return names.length > 0
        ? `import { ${names.join(', ')} } from 'effect';`
        : '';
    },
  });
};
