import type { ContextSpec, GeneratorImport, ResolverValue } from '../types';
import { pascal } from '../utils';
import { getSpecName } from '../utils/path';

interface GetAliasedImportsOptions {
  name?: string;
  resolvedValue: ResolverValue;
  existingImports: GeneratorImport[];
  context: ContextSpec;
}

export function getAliasedImports({
  name,
  resolvedValue,
  existingImports,
  context,
}: GetAliasedImportsOptions): GeneratorImport[] {
  return context.output.schemas && resolvedValue.isRef
    ? resolvedValue.imports.map((imp) => {
        if (
          !needCreateImportAlias({
            name,
            imp,
            existingImports,
          })
        ) {
          return imp;
        }

        const specName = pascal(
          getSpecName(imp.specKey ?? '', context.specKey),
        );

        // for spec starts from digit
        const normalizedSpecName = /^\d/.test(specName)
          ? `__${specName}`
          : specName;

        return {
          ...imp,
          alias: `${normalizedSpecName}__${imp.name}`,
        };
      })
    : resolvedValue.imports;
}

interface NeedCreateImportAliasOptions {
  name?: string;
  imp: GeneratorImport;
  existingImports: GeneratorImport[];
}

export function needCreateImportAlias({
  existingImports,
  imp,
  name,
}: NeedCreateImportAliasOptions): boolean {
  return (
    !imp.alias &&
    // !!imp.specKey &&
    (imp.name === name ||
      existingImports.some(
        (existingImport) =>
          imp.name === existingImport.name &&
          imp.specKey !== existingImport.specKey,
      ))
  );
}

interface GetImportAliasForRefOrValueOptions {
  resolvedValue: ResolverValue;
  imports: GeneratorImport[];
  context: ContextSpec;
}

export function getImportAliasForRefOrValue({
  context,
  imports,
  resolvedValue,
}: GetImportAliasForRefOrValueOptions): string {
  if (!context.output.schemas || !resolvedValue.isRef) {
    return resolvedValue.value;
  }
  const importWithSameName = imports.find(
    (imp) => imp.name === resolvedValue.value,
  );
  return importWithSameName?.alias ?? resolvedValue.value;
}
