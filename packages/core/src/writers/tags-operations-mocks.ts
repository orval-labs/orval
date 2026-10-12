import path from 'node:path';

import {
  type GeneratorOperationTarget,
  type MswMockOptions,
  OutputMockType,
  type WriteModeProps,
} from '../types';
import { getImportExtension, isFunction, kebab, pascal, upath } from '../utils';
import { getMockFileExtensionByTypeName } from '../utils/file-extensions';
import { writeGeneratedFile } from './file';
import {
  filterLocalStrictMockTypeImports,
  getFinalizeMockImplementationOptions,
} from './finalize-mock-implementation';
import { generateImportsForBuilder } from './generate-imports-for-builder';
import {
  collectRecoveredSchemaFactoryImports,
  mergeGeneratorImports,
} from './mock-imports';
import {
  buildCrossFileFakerImports,
  buildFakerReexportStatement,
  collapseMswFakerFullOutputs,
} from './mock-outputs';
import {
  getFakerEntry,
  getMockDir,
  resolveMockSchemasPath,
} from './mock-utils';

export interface TagsOperationsMockIndexEntry {
  ext: OutputMockType;
  mockDir: string;
  operations: { tag: string; opName: string; handlerName: string }[];
}

interface WriteTagsOperationsMockFilesOptions extends Pick<
  WriteModeProps,
  'builder' | 'output' | 'projectName' | 'header' | 'schemaTagMap'
> {
  schemaOutputPlan: WriteModeProps['schemaOutputPlan'];
  isAllowSyntheticDefaultImports: boolean;
  tag: string;
  operation: GeneratorOperationTarget;
  dirname: string;
  extension: string;
  schemasTarget: string;
  schemaCustomImportPath?: string;
  // Shared across every tag and operation, written once by
  // `writeTagsOperationsMockIndexes`.
  mockIndexEntries: TagsOperationsMockIndexEntry[];
}

/**
 * Writes one mock file per generator for an operation in the
 * `tags-operations` modes (`<mockDir>/<tag>/<operation>.<msw|faker><ext>`),
 * and records it for the mock index. As in `split-tags-mode.ts`, when both
 * msw and faker are configured the `get<Op>ResponseMock` factories live in
 * the `.faker` file only, and the `.msw` file imports and re-exports them.
 *
 * @returns The paths of the mock files written.
 */
export async function writeTagsOperationsMockFiles({
  builder,
  output,
  projectName,
  header,
  schemaTagMap,
  schemaOutputPlan,
  isAllowSyntheticDefaultImports,
  tag,
  operation,
  dirname,
  extension,
  schemasTarget,
  schemaCustomImportPath,
  mockIndexEntries,
}: WriteTagsOperationsMockFilesOptions): Promise<string[]> {
  const mswGeneratorEntry = output.mock.generators.find(
    (g): g is MswMockOptions => !isFunction(g) && g.type === OutputMockType.MSW,
  );
  const mockOutputs = collapseMswFakerFullOutputs(operation.mockOutputsFull, {
    mswOperationResponses: mswGeneratorEntry?.operationResponses,
  });

  const kebabOperation = kebab(operation.operationName);

  const fakerOutput = mockOutputs.find((m) => m.type === OutputMockType.FAKER);
  // Only import from the faker file when the collapse actually moved the
  // factories there, importing names that are still declared locally would
  // clash.
  const mswFactoriesMoved =
    !!fakerOutput &&
    mockOutputs.some(
      (m) =>
        m.type === OutputMockType.MSW &&
        m.implementation.function.trim().length === 0,
    );
  const fakerImplementation = fakerOutput?.implementation.function ?? '';
  const fakerEntry = getFakerEntry(output.mock);
  const fakerDir = fakerEntry
    ? (getMockDir(fakerEntry, output.mock) ?? dirname)
    : dirname;
  const fakerFilePath = path.join(
    fakerDir,
    tag,
    kebabOperation + '.faker' + extension,
  );
  const importExtension = getImportExtension(extension, output.tsconfig);

  const mockPaths: string[] = [];

  for (const mockOutput of mockOutputs) {
    const implementation =
      mockOutput.implementation.function + mockOutput.implementation.handler;
    // A faker output has no handler (and so no `handlerName`), only the
    // response factories. Skip only outputs with nothing to write, e.g. an
    // operation whose responses produce no factory.
    if (implementation.trim().length === 0) continue;

    const rawEntry = output.mock.generators.find((g) => {
      if (isFunction(g)) return mockOutput.type === OutputMockType.MSW;
      return g.type === mockOutput.type;
    });
    if (!rawEntry) continue;

    const mockExtension = isFunction(rawEntry)
      ? OutputMockType.MSW
      : getMockFileExtensionByTypeName(rawEntry);
    const mockDir = getMockDir(rawEntry, output.mock) ?? dirname;

    const mockFilePath = path.join(
      mockDir,
      tag,
      kebabOperation + '.' + mockExtension + extension,
    );

    const mockRelativeSchemasPath =
      schemaCustomImportPath ??
      resolveMockSchemasPath(mockFilePath, schemasTarget);

    const finalizeMockOptions = getFinalizeMockImplementationOptions(
      output,
      mockOutput,
    );

    const finalizedMockImplementation = builder.finalizeMockImplementation
      ? builder.finalizeMockImplementation(implementation, finalizeMockOptions)
      : implementation;

    const usesSchemaFactories =
      !isFunction(rawEntry) &&
      rawEntry.type === OutputMockType.FAKER &&
      rawEntry.schemas === true;
    const recoveredSchemaFactoryImports =
      usesSchemaFactories && output.schemas
        ? collectRecoveredSchemaFactoryImports(
            finalizedMockImplementation,
            builder.schemas.filter((s) => s.schema).map((s) => s.name),
          )
        : [];

    const crossFileFakerImports =
      mswFactoriesMoved && mockOutput.type === OutputMockType.MSW
        ? buildCrossFileFakerImports(
            mockFilePath,
            fakerFilePath,
            implementation,
            fakerImplementation,
            importExtension,
            fakerEntry?.importPath,
          )
        : [];

    const importsMockForBuilder = generateImportsForBuilder(
      output,
      filterLocalStrictMockTypeImports(
        mergeGeneratorImports(
          mockOutput.imports,
          recoveredSchemaFactoryImports,
          crossFileFakerImports,
        ),
        finalizeMockOptions.strictSchemaTypeNames,
      ),
      mockRelativeSchemasPath,
      schemaTagMap,
      schemaOutputPlan,
      mockFilePath,
    );

    let mockData = header;
    mockData += builder.importsMock({
      implementation: finalizedMockImplementation,
      imports: importsMockForBuilder,
      projectName,
      hasSchemaDir: !!output.schemas,
      isAllowSyntheticDefaultImports,
      options: isFunction(rawEntry) ? undefined : rawEntry,
    });
    // Re-export the factories so importing them from the msw file keeps
    // working.
    mockData += buildFakerReexportStatement(crossFileFakerImports);
    mockData += `\n${finalizedMockImplementation}`;

    await writeGeneratedFile(mockFilePath, mockData);
    mockPaths.push(mockFilePath);

    // The msw index re-exports each operation's handler by name, so an msw
    // output without one has nothing to list.
    const handlerName = mockOutput.implementation.handlerName;
    if (mockExtension === OutputMockType.MSW && !handlerName) continue;

    let indexEntry = mockIndexEntries.find(
      (e) => e.ext === mockExtension && e.mockDir === mockDir,
    );
    if (!indexEntry) {
      indexEntry = { ext: mockExtension, mockDir, operations: [] };
      mockIndexEntries.push(indexEntry);
    }
    if (
      !indexEntry.operations.some(
        (o) => o.tag === tag && o.opName === kebabOperation,
      )
    ) {
      indexEntry.operations.push({
        tag,
        opName: kebabOperation,
        handlerName,
      });
    }
  }

  return mockPaths;
}

/**
 * Writes the `<mockDir>/index.<msw|faker><ext>` mock indexes for the
 * `tags-operations` modes. Called once, after every tag has added its
 * operations to `mockIndexEntries`: the index lists operations from all tags,
 * so writing it per tag would let concurrent tags overwrite each other.
 *
 * @returns The paths of the indexes written.
 */
export async function writeTagsOperationsMockIndexes(
  mockIndexEntries: readonly TagsOperationsMockIndexEntry[],
  output: WriteModeProps['output'],
  extension: string,
): Promise<string[]> {
  if (!output.mock.indexMockFiles) return [];

  const mockImportExtension = getImportExtension(extension, output.tsconfig);
  const indexPaths: string[] = [];
  for (const { ext, mockDir, operations } of mockIndexEntries) {
    const indexPath = path.join(mockDir, `index.${ext}${extension}`);
    const indexContent = operations
      .toSorted(
        (a, b) =>
          a.tag.localeCompare(b.tag) || a.opName.localeCompare(b.opName),
      )
      .map(({ tag, opName, handlerName }) => {
        const localMockPath = upath.joinSafe(
          './',
          tag,
          opName + '.' + ext + mockImportExtension,
        );
        // Alias by `{tag, opName}` (this entry's dedup key, therefore always
        // unique) rather than re-exporting `handlerName` verbatim:
        // `handlerName` is derived from `operationName`, which a user's
        // `override.operationName` function can map to the same value for
        // multiple operations, producing two identically-named exports in
        // this shared barrel.
        const alias = `${pascal(tag)}${pascal(opName)}MockHandler`;
        return ext === OutputMockType.MSW
          ? `export { ${handlerName} as ${alias} } from '${localMockPath}'\n`
          : `export * from '${localMockPath}'\n`;
      })
      .join('');
    await writeGeneratedFile(indexPath, indexContent);
    indexPaths.push(indexPath);
  }
  return indexPaths;
}
