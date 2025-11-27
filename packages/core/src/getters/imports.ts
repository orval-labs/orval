import type { ContextSpecs, GeneratorImport, ResolverValue } from '../types';
import { pascal } from '../utils';
import { getSpecName } from '../utils/path';

export function getAliasedImports({
  name,
  resolvedValue,
  existingImports,
  context,
}: {
  name?: string;
  resolvedValue: ResolverValue;
  existingImports: GeneratorImport[];
  context: ContextSpecs;
}): GeneratorImport[] {
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

export function needCreateImportAlias({
  existingImports,
  imp,
  name,
}: {
  name?: string;
  imp: GeneratorImport;
  existingImports: GeneratorImport[];
}): boolean {
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

export function getImportAliasForRefOrValue({
  context,
  imports,
  resolvedValue,
}: {
  resolvedValue: ResolverValue;
  imports: GeneratorImport[];
  context: ContextSpecs;
}): string {
  if (!context.output.schemas || !resolvedValue.isRef) {
    return resolvedValue.value;
  }
  const importWithSameName = imports.find(
    (imp) => imp.name === resolvedValue.value,
  );
  return importWithSameName?.alias ?? resolvedValue.value;
}
