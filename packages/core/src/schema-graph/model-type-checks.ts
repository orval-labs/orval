import nodePath from 'node:path';

import type { Tsconfig } from '../types';
import { joinSafe, relativeSafe, toUnix } from '../utils/path';
import { jsStringLiteralEscape } from '../utils/string';
import { getImportExtension } from '../utils/tsconfig';
import { allocateConstName } from './component-names';

/** A component schema constant and the model it must match. */
export interface ModelTypeCheck {
  /** The name of the model type. */
  modelName: string;
  /** The identifier of the schema constant. */
  schemaName: string;
  /**
   * Why the schema is looser or stricter than the model on purpose. The check
   * is left out and a comment names the reason.
   */
  skipped?: string;
}

interface ModelTypeChecksInput {
  checks: readonly ModelTypeCheck[];
  /** The import specifier of the module that exports the models. */
  modelsImportPath: string;
  /** The type a schema constant outputs, as the library infers it. */
  inferOutput: (schemaName: string) => string;
  /** Names the module declares or imports, which the block must not reuse. */
  taken: ReadonlySet<string>;
  /**
   * Names that a scan of the module's text takes for a reference to an import,
   * which the type parameters of the helpers must not spell.
   */
  scanned?: ReadonlySet<string>;
}

export interface RenderedModelTypeChecks {
  /** The import of the models, placed with the module's imports. */
  importLine: string;
  /** The type-only declarations that fail `tsc` when a model drifts. */
  block: string;
}

/**
 * Type-only assertions that each schema constant outputs what its model
 * declares, in both directions. A skipped schema gets a comment in place of
 * its assertion. Nothing is emitted at runtime. Empty when there is no
 * check.
 */
export const renderModelTypeChecks = ({
  checks,
  modelsImportPath,
  inferOutput,
  taken,
  scanned = new Set(),
}: ModelTypeChecksInput): RenderedModelTypeChecks => {
  if (checks.length === 0) return { importLine: '', block: '' };
  const used = new Set(taken);
  const models = allocateConstName('Models', used);
  const assert = allocateConstName('Assert', used);
  const extendsName = allocateConstName('Extends', used);
  const checksName = allocateConstName('SchemaModelTypeChecks', used);
  const readerName = allocateConstName('schemaModelTypeChecks', used);
  const parameters = new Set(scanned);
  const [assertParameter, leftParameter, rightParameter] = ['T', 'A', 'B'].map(
    (name) => allocateConstName(name, parameters),
  );
  const hasAssertion = checks.some(({ skipped }) => skipped === undefined);

  const entries = checks.map(({ modelName, schemaName, skipped }) => {
    if (skipped !== undefined) {
      return `  // ${modelName}: skipped, ${skipped}`;
    }
    const output = inferOutput(schemaName);
    const model = `${models}.${modelName}`;
    return [
      `  ${modelName}: [`,
      `    ${assert}<${extendsName}<${output}, ${model}>>,`,
      `    ${assert}<${extendsName}<${model}, ${output}>>,`,
      '  ];',
    ].join('\n');
  });
  // The type stays local, so `export *` of several modules cannot clash on
  // it. An ambient constant reads it, which `noUnusedLocals` accepts, and
  // which emits nothing.
  const declaration = [
    `type ${checksName} = {`,
    ...entries,
    '};',
    `declare const ${readerName}: ${checksName};`,
  ];

  // Without an assertion, the import and the helpers would be unused.
  if (!hasAssertion) return { importLine: '', block: declaration.join('\n') };
  return {
    // A directory name may hold a quote or a backslash.
    importLine: `import type * as ${models} from '${jsStringLiteralEscape(modelsImportPath)}';`,
    block: [
      `type ${assert}<${assertParameter} extends true> = ${assertParameter};`,
      `type ${extendsName}<${leftParameter}, ${rightParameter}> = [${leftParameter}] extends [${rightParameter}] ? true : false;`,
      ...declaration,
    ].join('\n'),
  };
};

// The file `writeSchemas` writes to export the models. The extension of the
// module that checks them has no say in it.
const MODELS_INDEX_FILE_EXTENSION = '.ts';

/**
 * The import specifier of the models directory, relative to the directory of
 * the module that imports it. The directory name is kept whole, a dot in it
 * is not an extension. Where the tsconfig needs an extension on an import,
 * such as `.js` under NodeNext or `.ts` with `allowImportingTsExtensions`, it
 * names the `index` file of the models. Otherwise it is a directory import.
 * Either way it needs the `index.ts` that `writeSchemas` writes, so the
 * config that writes the models must keep `indexFiles` on, which is the
 * default.
 */
export const getModelsImportPath = (
  modulePath: string,
  modelsDirectory: string,
  tsconfig?: Tsconfig,
): string => {
  const directory = relativeSafe(
    toUnix(nodePath.dirname(modulePath)),
    modelsDirectory,
  );
  const indexExtension = getImportExtension(
    MODELS_INDEX_FILE_EXTENSION,
    tsconfig,
  );
  return indexExtension === ''
    ? directory
    : joinSafe(directory, `index${indexExtension}`);
};
