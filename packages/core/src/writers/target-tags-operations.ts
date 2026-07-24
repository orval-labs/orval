import {
  DefaultTag,
  type GeneratorImport,
  type GeneratorOperation,
  type GeneratorOperationTarget,
  type GeneratorSchema,
  type GeneratorTagHelpers,
  type GeneratorTagOperationsTarget,
  type NormalizedOutputOptions,
  OutputClient,
  type WriteSpecBuilder,
} from '../types';
import { getOperationTagKey, isOperationInTagBucket, pascal } from '../utils';
import { flattenMockOutput } from './mock-outputs';
import { hasTypeScriptAwaitedType } from './typescript-version';

function isSchemaImport(imp: GeneratorImport): boolean {
  return !imp.importPath;
}

/**
 * Resolves the transitive closure of component schemas an operation's
 * implementation references, so `tags-operations-split`'s per-operation
 * `.schemas` file includes not just the schemas named directly in the
 * operation's imports but everything those schemas reference too (e.g. a
 * `Pet` schema composed from `Dog` / `Cat` via `oneOf`). Mirrors the
 * traversal in `schema-tag-mapper.ts`'s `propagateTransitiveTags`.
 */
export function resolveTransitiveSchemas(
  directNames: Iterable<string>,
  schemas: readonly GeneratorSchema[],
): GeneratorSchema[] {
  const schemaByName = new Map(schemas.map((s) => [s.name, s]));
  const included = new Set<string>();
  const queue = [...directNames];

  while (queue.length > 0) {
    const name = queue.pop()!;
    if (included.has(name)) continue;
    const schema = schemaByName.get(name);
    if (!schema) continue;
    included.add(name);
    for (const imp of schema.imports) {
      if (isSchemaImport(imp) && !included.has(imp.name)) {
        queue.push(imp.name);
      }
    }
  }

  return schemas.filter((s) => included.has(s.name));
}

// Matches top-level `type`/`const`/`function` declarations (optionally
// already exported) so the shared helper block's declared identifiers can be
// re-imported by name into each operation file. A side-effect-only import
// (`import './tag.helpers'`) never brings the names into scope, so callers
// must know exactly what to name in an import statement — and whether that
// name is a type (safe to strip at compile time) or a runtime value like
// `withQueryKey` (must survive as a real import, not `import type`). Client
// header builders write these declarations assuming they land inline in the
// operation file, so most are not `export`ed; capturing group 1 isolates the
// existing `export ` (if any) so the rewrite step below can force it on
// without doubling up.
const TYPE_DECLARATION_RE = /^(export\s+)?type\s+([A-Za-z_$][\w$]*)/gm;
const VALUE_DECLARATION_RE =
  /^(export\s+)?(const|function)\s+([A-Za-z_$][\w$]*)/gm;

/**
 * Extracts the top-level `type`/`const`/`function` names declared in the
 * tag helper block, and rewrites the block so every one of them is
 * `export`ed — necessary now that the block lives in its own module and is
 * imported by name rather than inlined into the operation file.
 */
function extractDeclaredNames(implementation: string): {
  implementation: string;
  typeNames: string[];
  valueNames: string[];
} {
  const typeNames = [...implementation.matchAll(TYPE_DECLARATION_RE)].map(
    (match) => match[2],
  );
  const valueNames = [...implementation.matchAll(VALUE_DECLARATION_RE)].map(
    (match) => match[3],
  );
  const exported = implementation
    .replaceAll(TYPE_DECLARATION_RE, (whole, existingExport: string) =>
      existingExport ? whole : `export ${whole}`,
    )
    .replaceAll(VALUE_DECLARATION_RE, (whole, existingExport: string) =>
      existingExport ? whole : `export ${whole}`,
    );
  return { implementation: exported, typeNames, valueNames };
}

/**
 * Builds the import statement(s) an operation file uses to pull in its
 * tag's shared helper block, or `''` when the helper has nothing to export.
 * A plain `import './tag.helpers'` would compile but never bring the
 * helper's `type`/`const` names into scope — callers must import them by
 * name, and type names must use `import type` while runtime values
 * (e.g. `withQueryKey`) need a real import so they survive to the emitted JS.
 */
export function buildTagHelpersImport(
  helpers: GeneratorTagHelpers,
  helperImportPath: string,
  usedIn?: string,
): string {
  const used = (name: string) =>
    !usedIn || new RegExp(String.raw`\b${name}\b`).test(usedIn);

  const typeNames = helpers.typeNames.filter(used);
  const valueNames = helpers.valueNames.filter(used);

  let result = '';
  if (typeNames.length > 0) {
    result += `import type { ${typeNames.join(', ')} } from '${helperImportPath}';\n`;
  }
  if (valueNames.length > 0) {
    result += `import { ${valueNames.join(', ')} } from '${helperImportPath}';\n`;
  }
  return result;
}

/**
 * Ensures every operation has at least one tag by falling back to the
 * {@link DefaultTag} constant for untagged operations, mirroring
 * `target-tags.ts`'s `addDefaultTagIfEmpty` so operations without a tag still
 * land in a bucket.
 */
function addDefaultTagIfEmpty(operation: GeneratorOperation) {
  return {
    ...operation,
    tags: operation.tags.length > 0 ? operation.tags : [DefaultTag],
  };
}

/**
 * Builds one {@link GeneratorTagOperationsTarget} per tag for the
 * `tags-operations` / `tags-operations-split` modes. Unlike
 * `generateTargetForTags`, operations within a tag are NOT merged into a
 * single implementation string — each operation keeps its own
 * implementation so the caller can write it to its own file.
 *
 * The tag's header/footer are still computed once (from the merged
 * implementation of every operation in the tag, exactly as
 * `generateTargetForTags` does) so client builders that key their output on
 * tag-wide signals (e.g. "does any operation in this tag use a mutator")
 * produce the same boilerplate they would in `tags` mode. That boilerplate
 * becomes the tag's shared `helpers` block, written once per tag and
 * imported by every operation file in that tag instead of being duplicated.
 */
export function generateTargetForTagsOperations(
  builder: WriteSpecBuilder,
  options: NormalizedOutputOptions,
): Record<string, GeneratorTagOperationsTarget> {
  const isAngularClient = options.client === OutputClient.ANGULAR;
  const hasAwaitedType = hasTypeScriptAwaitedType(options.packageJson);

  const operations = Object.values(builder.operations).map((operation) =>
    addDefaultTagIfEmpty(operation),
  );

  const tags = [...new Set(operations.map((op) => getOperationTagKey(op)))];

  const result: Record<string, GeneratorTagOperationsTarget> = {};

  for (const tag of tags) {
    const tagOperations = operations.filter((operation) =>
      isOperationInTagBucket(operation, tag),
    );

    const mergedImplementation = tagOperations
      .map((operation) => operation.implementation)
      .join('');
    const mergedMutators = tagOperations
      .map((operation) => operation.mutator)
      .filter((mutator): mutator is NonNullable<typeof mutator> => !!mutator);

    const isMutator = mergedMutators.some((mutator) =>
      isAngularClient ? mutator.hasThirdArg : mutator.hasSecondArg,
    );

    const titles = builder.title({
      outputClient: options.client,
      title: pascal(tag),
      customTitleFunc: options.override.title,
      output: options,
    });

    const footer = builder.footer({
      outputClient: options.client,
      operationNames: tagOperations.map(({ operationName }) => operationName),
      operations: tagOperations,
      hasMutator: mergedMutators.length > 0,
      hasAwaitedType,
      titles,
      output: options,
    });

    const header = builder.header({
      outputClient: options.client,
      isRequestOptions: options.override.requestOptions !== false,
      isMutator,
      isGlobalMutator: !!options.override.mutator,
      provideIn: options.override.angular.provideIn,
      hasAwaitedType,
      titles,
      output: options,
      verbOptions: builder.verbOptions,
      tag,
      isDefaultTagBucket:
        tag === DefaultTag &&
        Object.values(builder.operations).some(
          (operation) => operation.tags.length === 0,
        ),
      clientImplementation: mergedImplementation,
    });

    const sharedTypes = header.sharedTypes;
    const inlinedSharedTypes =
      sharedTypes && sharedTypes.length > 0
        ? sharedTypes
            .map((t) => `${t.exported ? 'export ' : ''}${t.code}`)
            .join('\n') + '\n\n'
        : '';

    const rawHelperImplementation =
      inlinedSharedTypes + header.implementation + footer.implementation;
    const {
      implementation: helperImplementation,
      typeNames,
      valueNames,
    } = extractDeclaredNames(rawHelperImplementation);

    const operationTargets: GeneratorOperationTarget[] = tagOperations.map(
      (operation) => {
        // Each operation is its own file, so its mock handler gets its own
        // header/footer wrap rather than sharing one wrap across the whole
        // tag (as `target-tags.ts` does for the merged tag file).
        const wrappedMockOutputs = operation.mockOutputs.map((m) => ({
          type: m.type,
          implementation: {
            function: m.implementation.function,
            handler: m.implementation.handlerName
              ? m.implementation.handler +
                header.implementationMock +
                m.implementation.handlerName +
                footer.implementationMock
              : m.implementation.handler,
            handlerName: m.implementation.handlerName,
          },
          imports: m.imports,
          strictMockSchemaTypeNames: m.strictMockSchemaTypeNames,
          strictMockSchemaKinds: m.strictMockSchemaKinds,
        }));

        return {
          operationName: operation.operationName,
          imports: operation.imports,
          implementation: operation.implementation,
          mockOutputs: wrappedMockOutputs.map((m) => flattenMockOutput(m)),
          mockOutputsFull: wrappedMockOutputs,
          mutators: operation.mutator ? [operation.mutator] : undefined,
          clientMutators: operation.clientMutators,
          formData: operation.formData ? [operation.formData] : undefined,
          formUrlEncoded: operation.formUrlEncoded
            ? [operation.formUrlEncoded]
            : undefined,
          paramsSerializer: operation.paramsSerializer
            ? [operation.paramsSerializer]
            : undefined,
          paramsFilter: operation.paramsFilter
            ? [operation.paramsFilter]
            : undefined,
          fetchReviver: operation.fetchReviver
            ? [operation.fetchReviver]
            : undefined,
        };
      },
    );

    result[tag] = {
      helpers: {
        implementation: helperImplementation,
        sharedTypes,
        typeNames,
        valueNames,
      },
      operations: operationTargets,
    };
  }

  return result;
}
