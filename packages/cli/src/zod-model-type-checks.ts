import {
  type ContextSpec,
  type GeneratorImport,
  getComponentKey,
  getFileInfo,
  getModelsImportPath,
  getModuleIdentifiers,
  getModelTypeCheckSkips,
  type ModelTypeCheck,
  type RenderedModelTypeChecks,
  renderModelTypeChecks,
  toComponentRef,
} from '@orval/core';

import {
  type ReusableSchemaEntry,
  resolveSchemaName,
} from './reusable-schemas';

/** What the Zod model type checks need besides the component schemas. */
export interface ZodModelTypeCheckOptions {
  /** The rest of the module around the component schemas. */
  moduleContent?: string;
  /** Whether the output is Zod 4 or Zod Mini, not Zod 3. */
  isZodV4?: boolean;
  /** The imports of the refinements the module is written with. */
  refinementImports?: readonly GeneratorImport[];
  /** The local names of imports that the module adds around the schemas. */
  importedNames?: readonly string[];
}

// The local names of every function and type the `formatType` entries import.
const getFormatTypeNames = ({
  formatType = {},
}: ContextSpec['output']['override']): string[] =>
  Object.values(formatType).flatMap((config) =>
    [
      config?.import,
      config?.decodeImport,
      config?.encodeImport,
      config?.zod?.transformImport,
      config?.zod?.codecImport,
    ].flatMap((imp) => (imp ? [imp.alias ?? imp.name] : [])),
  );

/**
 * The checks that the output type of each component schema and its model
 * agree. The models are written by another configuration, so their import
 * path is relative to the directory of `output.target`, where the schemas are
 * written in every mode. A constant is named like its model, so one name
 * serves both. A schema that is looser than its model on purpose is skipped.
 * Empty unless `override.modelTypeChecks` is set. The helper names avoid the
 * names of `content`, the constants, the `formatType` functions `content`
 * references, which the module imports, and the names of `moduleContent`, the
 * rest of the module around them, and `importedNames`, the imports that the
 * module adds. The imports of the refinements and every
 * `formatType` import of the output count too, whichever file uses them: the
 * module may be written without the operations.
 */
export const generateZodModelTypeChecks = (
  context: ContextSpec,
  entries: readonly ReusableSchemaEntry[],
  content: string,
  {
    moduleContent = '',
    isZodV4 = true,
    refinementImports = [],
    importedNames = [],
  }: ZodModelTypeCheckOptions = {},
): RenderedModelTypeChecks => {
  const { modelTypeChecks } = context.output.override;
  if (!modelTypeChecks) return { importLine: '', block: '' };

  const skips = getModelTypeCheckSkips(context, {
    library: 'zod',
    nameOf: (key) => resolveSchemaName(toComponentRef(key), context),
    isZodV4,
  });
  const checks: ModelTypeCheck[] = entries.map(({ name, ref }) => {
    const skipped = skips.get(getComponentKey(ref) ?? '');
    return {
      schemaName: name,
      modelName: name,
      ...(skipped === undefined ? {} : { skipped }),
    };
  });
  const { path: targetPath } = getFileInfo(context.output.target, {
    extension: context.output.fileExtension,
  });

  return renderModelTypeChecks({
    checks,
    modelsImportPath: getModelsImportPath(
      targetPath,
      modelTypeChecks.models,
      context.output.tsconfig,
    ),
    // `zod.output` exists in Zod 3, Zod 4 and Zod Mini alike.
    inferOutput: (name) => `zod.output<typeof ${name}>`,
    scanned: new Set(getFormatTypeNames(context.output.override)),
    taken: new Set([
      'zod',
      ...entries.map(({ name }) => name),
      ...getFormatTypeNames(context.output.override),
      ...refinementImports.map(({ name, alias }) => alias ?? name),
      ...importedNames,
      // What the rest of the module imports or declares.
      ...getModuleIdentifiers(`${content}\n${moduleContent}`),
    ]),
  });
};
