import { generateMutatorImports } from '../generators';
import type {
  GeneratorDependency,
  GeneratorImport,
  GeneratorMutator,
  NormalizedOutputOptions,
  WriteSpecBuilder,
} from '../types';
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
  return imports.filter((imp) => {
    const searchWords = [imp.alias, imp.name]
      .filter((part): part is string => Boolean(part?.length))
      .map((part) => escapeRegExp(part))
      .join('|');
    if (!searchWords) {
      return false;
    }

    return new RegExp(String.raw`\b(${searchWords})\b`, 'g').test(
      implementation,
    );
  });
}

/** The client's import header for one implementation file. */
export function generateClientImports({
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
}): string {
  return builder.imports({
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
 * the generated file declares them. Only the plain `mutators` are matched
 * against `implementation`; the other kinds are always imported.
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

  for (const mutators of [
    target.clientMutators,
    target.formData,
    target.formUrlEncoded,
    target.paramsSerializer,
    target.paramsFilter,
    target.fetchReviver,
  ]) {
    if (mutators) {
      data += generateMutatorImports({ mutators, oneMore });
    }
  }

  return data;
}

/**
 * Local type declarations an implementation relies on (`NonReadonly<>`,
 * `TypedResponse<>`), emitted only when the implementation uses them.
 */
export function generateOrvalHelperTypes(implementation: string): string {
  let data = '';

  if (implementation.includes('NonReadonly<')) {
    data += getOrvalGeneratedTypes();
    data += '\n';
  }

  if (implementation.includes('TypedResponse<')) {
    data += getTypedResponse();
    data += '\n';
  }

  return data;
}
