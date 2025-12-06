import type { ContextSpec, GeneratorImport, ResolverValue } from '../types';

interface GetAliasedImportsOptions {
  name?: string;
  resolvedValue: ResolverValue;
  context: ContextSpec;
}

export function getAliasedImports({
  name,
  resolvedValue,
  context,
}: GetAliasedImportsOptions): GeneratorImport[] {
  return context.output.schemas && resolvedValue.isRef
    ? resolvedValue.imports.map((imp) => {
        if (
          !needCreateImportAlias({
            name,
            imp,
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
}

export function needCreateImportAlias({
  imp,
  name,
}: NeedCreateImportAliasOptions): boolean {
  return !imp.alias && imp.name === name;
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
