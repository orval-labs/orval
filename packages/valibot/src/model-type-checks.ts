import {
  type ContextSpec,
  getFileInfo,
  getModelsImportPath,
  getModelTypeCheckSkips,
  type ModelTypeCheck,
  type RenderedModelTypeChecks,
  renderModelTypeChecks,
} from '@orval/core';

import { createRefPolicy, getComponentModes } from './ref-policy';
import {
  getComponentNames,
  getExportNames,
  type ValibotComponentConst,
} from './reusable-schemas';

/**
 * The checks that the output type of each component constant and its model
 * agree. The models are written by another configuration, so their import
 * path is relative to the directory of the module the constants are written
 * to, which is the directory of `output.target` in every mode. A constant
 * that is looser than its model on purpose is skipped. Empty unless
 * `override.modelTypeChecks` is set.
 */
export const generateValibotModelTypeChecks = (
  context: ContextSpec,
  consts: readonly ValibotComponentConst[],
  taken: ReadonlySet<string>,
): RenderedModelTypeChecks => {
  const { modelTypeChecks } = context.output.override;
  if (!modelTypeChecks) return { importLine: '', block: '' };

  const exportNames = getExportNames(context);
  const modelNameOf = (name: string): string => exportNames.get(name) ?? name;
  const componentNames = getComponentNames(context);
  const skips = getModelTypeCheckSkips(context, {
    library: 'valibot',
    nameOf: (key) => modelNameOf(componentNames.get(key) ?? key),
    refPolicy: createRefPolicy({ context, ...getComponentModes(context) }),
  });
  const keys = new Map(
    [...componentNames].map(([key, name]) => [name, key] as const),
  );
  const checks: ModelTypeCheck[] = consts.map(({ name }) => {
    const skipped = skips.get(keys.get(name) ?? name);
    return {
      schemaName: name,
      modelName: modelNameOf(name),
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
    inferOutput: (name) => `v.InferOutput<typeof ${name}>`,
    taken,
  });
};
