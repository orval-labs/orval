import type { ContextSpec, GeneratorImport, ResolverValue } from '../types';

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

        return {
          ...imp,
          alias: `__${imp.name}`,
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
    !imp.alias && imp.name === name
    // ||
    // existingImports.some(
    //   (existingImport) => imp.name === existingImport.name,
    // )
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
