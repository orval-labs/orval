import {
  type GeneratorImport,
  type GeneratorMockOutput,
  type GeneratorMockOutputFull,
  OutputMockType,
} from '../types';
import { upath } from '../utils';

/**
 * Collapses the per-generator mock outputs for "inline" writer modes
 * (`single`, `tags`) where every mock generator's content is concatenated
 * into the implementation file. The MSW generator already emits the
 * response-factory functions (`get<Op>ResponseMock`) that Faker would emit,
 * so when both generators are configured we keep MSW and drop Faker to
 * avoid duplicate function declarations and re-imported faker bindings.
 */
export function collapseInlineMockOutputs<
  T extends GeneratorMockOutput | GeneratorMockOutputFull,
>(mockOutputs: T[]): T[] {
  const hasMsw = mockOutputs.some((m) => m.type === OutputMockType.MSW);
  if (!hasMsw) return mockOutputs;
  return mockOutputs.filter((m) => m.type !== OutputMockType.FAKER);
}

/**
 * Flattens a `GeneratorMockOutputFull` (which keeps `function` and `handler`
 * separate) into a `GeneratorMockOutput` by concatenating the two portions.
 */
export function flattenMockOutput(
  full: GeneratorMockOutputFull,
): GeneratorMockOutput {
  return {
    type: full.type,
    implementation: full.implementation.function + full.implementation.handler,
    imports: full.imports,
    strictMockSchemaTypeNames: full.strictMockSchemaTypeNames,
    strictMockSchemaKinds: full.strictMockSchemaKinds,
  };
}

// Handler fallback calls are always emitted argument-less, so match an
// empty `()` exactly.
const RESPONSE_MOCK_CALL_RE = /:\s*(get\w+ResponseMock\w*)\(\)/g;

export interface CollapseMswFakerOptions {
  // The msw generator's `operationResponses` flag. When false and no faker
  // output provides the factories, the handlers fall back to `undefined`
  // instead of calling the response factories.
  mswOperationResponses?: boolean;
}

/**
 * Decides where the `get<Op>ResponseMock` factories live so `.msw.ts` never
 * duplicates them:
 *
 * - The faker output declares every factory the handlers call: strip them
 *   from the MSW output, the writer imports them from the faker file instead.
 * - `mswOperationResponses` is false: strip the factories and replace the
 *   handler fallbacks with `undefined`.
 * - Otherwise leave the output unchanged, factories stay inline in `.msw.ts`.
 *
 * No need to remove the `faker` import when stripping, it is only added
 * during import generation while the implementation still uses `faker.*`.
 */
export function collapseMswFakerFullOutputs(
  mockOutputs: GeneratorMockOutputFull[],
  options: CollapseMswFakerOptions = {},
): GeneratorMockOutputFull[] {
  const mswEntry = mockOutputs.find((m) => m.type === OutputMockType.MSW);
  if (!mswEntry || mswEntry.implementation.function.trim().length === 0)
    return mockOutputs;

  const fakerEntry = mockOutputs.find((m) => m.type === OutputMockType.FAKER);

  // Factories can only move if the faker output declares every factory the
  // handlers call, otherwise the handlers would call names that don't exist
  // (e.g. faker configured with operationResponses: false).
  let fakerDeclaresAllReferenced = false;
  if (fakerEntry) {
    const declared = new Set(
      extractResponseMockNames(fakerEntry.implementation.function),
    );
    fakerDeclaresAllReferenced = extractResponseMockNames(
      mswEntry.implementation.handler,
    ).every((name) => declared.has(name));
  }

  if (fakerDeclaresAllReferenced) {
    return mockOutputs.map((m) =>
      m.type === OutputMockType.MSW
        ? { ...m, implementation: { ...m.implementation, function: '' } }
        : m,
    );
  }

  if (options.mswOperationResponses === false) {
    const strippedHandler = mswEntry.implementation.handler.replaceAll(
      RESPONSE_MOCK_CALL_RE,
      ': undefined',
    );

    return mockOutputs.map((m) =>
      m.type === OutputMockType.MSW
        ? {
            ...m,
            implementation: {
              ...m.implementation,
              function: '',
              handler: strippedHandler,
            },
          }
        : m,
    );
  }

  return mockOutputs;
}

const RESPONSE_MOCK_NAME_RE = /\bget\w+ResponseMock\w*\b/g;

/**
 * Collects the unique `get<Op>ResponseMock` names in a mock implementation,
 * including the status-suffixed ones from `generateEachHttpStatus`
 * (e.g. `getListPetsResponseMock200`).
 */
export function extractResponseMockNames(implementation: string): string[] {
  return [
    ...new Set(
      [...implementation.matchAll(RESPONSE_MOCK_NAME_RE)].map((m) => m[0]),
    ),
  ];
}

/**
 * Builds the imports that let a `.msw.ts` file call the response factories
 * declared in its `.faker.ts` file. Only imports names the handlers actually
 * call and the faker file actually declares, so the import list can't drift
 * out of sync with either file.
 */
export function buildCrossFileFakerImports(
  mswFilePath: string,
  fakerFilePath: string,
  mswImplementation: string,
  fakerImplementation: string,
  importExtension = '',
): GeneratorImport[] {
  const referencedNames = extractResponseMockNames(mswImplementation);
  if (referencedNames.length === 0) return [];

  const declaredNames = new Set(extractResponseMockNames(fakerImplementation));
  const responseMockNames = referencedNames.filter((name) =>
    declaredNames.has(name),
  );
  if (responseMockNames.length === 0) return [];

  const fakerImportPath =
    upath.getRelativeImportPath(mswFilePath, fakerFilePath) + importExtension;

  return responseMockNames.map(
    (name): GeneratorImport => ({
      name,
      values: true,
      importPath: fakerImportPath,
    }),
  );
}

/**
 * Re-export statement for the factories a `.msw.ts` file imports from its
 * faker file, so importing them from the msw file keeps working like before
 * the split.
 */
export function buildFakerReexportStatement(
  imports: readonly GeneratorImport[],
): string {
  if (imports.length === 0) return '';
  const names = imports.map((imp) => imp.name).join(', ');
  return `export { ${names} } from '${imports[0].importPath}';\n`;
}
