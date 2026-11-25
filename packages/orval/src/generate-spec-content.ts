import {
  generateModelsInline,
  type NormalizedOptions,
  withMutatorSourceCache,
} from '@orval/core';

import { importSpecs } from './import-specs';
import { getHeader } from './write-specs';

/**
 * Generate the type definitions of a single Orval project without writing any
 * file.
 *
 * The content is one module: the models of `components` and the types derived
 * from the operations (parameters, request bodies and responses). Client
 * functions, mocks and validation schemas are not generated, so the options
 * that place or post-process files (`output.target`, `mode`, `schemas`,
 * `workspace`, `mock`, `clean`, formatter, hooks, docs) have no effect.
 *
 * @param workspace - Absolute or relative workspace path used to resolve imports.
 * @param options - Normalized generation options for this project.
 * @param projectName - Optional project name used in generation.
 * @returns The generated content.
 *
 * @example
 * const content = await generateSpecContent(process.cwd(), normalizedOptions);
 */
export async function generateSpecContent(
  workspace: string,
  options: NormalizedOptions,
  projectName?: string,
): Promise<string> {
  // Without `output.target` the API builder takes its schemas-only path: it
  // collects the types derived from the operations but generates no client.
  // The field is typed as a string, and the builder tests it for truthiness.
  const typesOnlyOptions: NormalizedOptions = {
    ...options,
    output: {
      ...options.output,
      target: '',
      schemas: undefined,
      operationSchemas: undefined,
      workspace: undefined,
      mock: { ...options.output.mock, generators: [] },
      // `const` and `enum` emit runtime values, which a content without a
      // runtime module cannot provide.
      override: { ...options.output.override, enumGenerationType: 'union' },
    },
  };

  return withMutatorSourceCache(async () => {
    const builder = await importSpecs(workspace, typesOnlyOptions, projectName);

    return (
      getHeader(typesOnlyOptions.output.override.header, builder.info) +
      generateModelsInline(builder.schemas)
    );
  });
}
