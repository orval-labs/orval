import path from 'node:path';

import { filterUsedMutators, generateMutatorImports } from '../generators';
import type {
  GeneratorDependency,
  GeneratorImport,
  GeneratorMutator,
  NormalizedOutputOptions,
  WriteSpecBuilder,
} from '../types';
import { upath } from '../utils';
import { escapeRegExp } from '../utils/string';
import { getOrvalGeneratedTypes, getTypedResponse } from './types';

/**
 * Keeps only the imports whose name or alias appears in `implementation`, so
 * an import pulled in by another tag or operation does not leak into a file
 * that never references it.
 */
export function filterImportsUsedInImplementation(
  imports: GeneratorImport[],
  implementation: string,
): GeneratorImport[] {
  if (!imports.some((imp) => imp.alias || imp.name)) return [];

  // JavaScript's word boundaries use ASCII word characters without the `u`
  // and `i` flags. Index those words once for the common identifier case.
  const words = new Set(implementation.match(/\w+/g) ?? []);
  const isUsed = (part: string | undefined): boolean => {
    if (!part) return false;
    if (!/\W/.test(part)) return words.has(part);

    // Non-word characters can themselves sit at a word boundary, so retain
    // the original matching semantics for those names.
    return new RegExp(String.raw`\b${escapeRegExp(part)}\b`, 'g').test(
      implementation,
    );
  };

  return imports.filter((imp) => {
    return isUsed(imp.alias) || isUsed(imp.name);
  });
}

/** The client's import header for one implementation file. */
export async function generateClientImports({
  builder,
  output,
  implementation,
  imports,
  projectName,
  isAllowSyntheticDefaultImports,
}: {
  builder: Pick<WriteSpecBuilder, 'imports'>;
  output: NormalizedOutputOptions;
  implementation: string;
  imports: readonly GeneratorDependency[];
  projectName?: string;
  isAllowSyntheticDefaultImports: boolean;
}): Promise<string> {
  return await builder.imports({
    client: output.client,
    implementation,
    imports,
    projectName,
    hasSchemaDir: !!output.schemas,
    isAllowSyntheticDefaultImports,
    hasGlobalMutator: !!output.override.mutator,
    hasTagsMutator: Object.values(output.override.tags).some(
      (tag) => !!tag?.mutator,
    ),
    hasParamsSerializerOptions: !!output.override.paramsSerializerOptions,
    packageJson: output.packageJson,
    output,
  });
}

export interface TargetMutators {
  mutators?: GeneratorMutator[];
  clientMutators?: GeneratorMutator[];
  formData?: GeneratorMutator[];
  formUrlEncoded?: GeneratorMutator[];
  paramsSerializer?: GeneratorMutator[];
  paramsFilter?: GeneratorMutator[];
  fetchReviver?: GeneratorMutator[];
}

/**
 * Import statements for every mutator kind a target carries, in the order
 * the generated file declares them. A configured `paramsSerializer`,
 * `paramsFilter`, `formData`, `formUrlEncoded` or `fetch.jsonReviver` is
 * attached to every operation, so those kinds are matched against
 * `implementation` and a file whose operations never call one does not
 * import it. Client mutators are always imported: a client may call them
 * from code outside `implementation`, as the zod client does for its params
 * mutator in inline component schemas.
 */
export function generateTargetMutatorImports(
  target: TargetMutators,
  implementation: string,
  oneMore?: boolean,
): string {
  let data = '';

  if (target.mutators) {
    data += generateMutatorImports({
      mutators: target.mutators,
      implementation,
      oneMore,
    });
  }

  if (target.clientMutators) {
    data += generateMutatorImports({
      mutators: target.clientMutators,
      oneMore,
    });
  }

  const optionalMutators = [
    target.formData,
    target.formUrlEncoded,
    target.paramsSerializer,
    target.paramsFilter,
    target.fetchReviver,
  ].flatMap((mutators) => mutators ?? []);

  if (optionalMutators.length > 0) {
    data += generateMutatorImports({
      mutators: filterUsedMutators(optionalMutators, implementation),
      oneMore,
    });
  }

  return data;
}

/**
 * Local type declarations an implementation relies on (`NonReadonly<>`,
 * `TypedResponse<>`), emitted only when the implementation uses them.
 */
export function generateOrvalHelperTypes(
  implementation: string,
  useReadonlyArrays = false,
): string {
  let data = '';

  if (implementation.includes('NonReadonly<')) {
    data += getOrvalGeneratedTypes(useReadonlyArrays);
    data += '\n';
  }

  if (implementation.includes('TypedResponse<')) {
    data += getTypedResponse();
    data += '\n';
  }

  return data;
}

export function rebaseRelativeImportPaths(
  imports: GeneratorImport[],
  {
    dirname,
    importerPath,
    extension,
  }: { dirname: string; importerPath: string; extension: string },
): GeneratorImport[] {
  return imports.map((imp) => {
    if (!imp.importPath?.startsWith('.')) return imp;
    const targetFile = path.resolve(dirname, imp.importPath) + extension;
    return {
      ...imp,
      importPath: upath.getRelativeImportPath(importerPath, targetFile),
    };
  });
}
