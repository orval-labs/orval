import {
  camel,
  type GeneratorOperation,
  getUniqueName,
  type NormalizedOutputOptions,
  OutputClient,
  pascal,
} from '@orval/core';

/**
 * Whether the fetch client is wrapped in an `httpClientInjection: 'factory'`
 * closure. Factory injection is output-scoped (the header and footer only see
 * `output.override`), and limited to the plain fetch client: query, swr, mcp
 * and pinia-colada reuse these generators but emit no factory wrapper.
 */
export const isFetchFactoryMode = (
  output: NormalizedOutputOptions | undefined,
) =>
  output?.client === OutputClient.FETCH &&
  output.override.fetch.httpClientInjection === 'factory';

/** Opens the factory closure that receives the `fetch` implementation once. */
export const getFactoryOpening = (title: string) =>
  `export const ${title} = (fetchFn: typeof globalThis.fetch = fetch) => {\n`;

// Stands for the factory's `fetch` in the operations until the operations are
// placed in the closure and their parameter names are known.
const FACTORY_FETCH_REFERENCE = '/* orval:factory-fetch */';

/**
 * The shared-style `execute` options inside the factory: the factory's `fetch`
 * is the default, and a per-call `options.fetch` still wins.
 */
export const FACTORY_EXECUTE_OPTIONS = `options: { fetch: ${FACTORY_FETCH_REFERENCE}, ...options }`;

// Delimit a shared-style operation that the client header moves into the
// factory closure; the rest of the operation stays at module level.
const FACTORY_OPERATION_START = '/* orval:factory-operation-start */';
const FACTORY_OPERATION_END = '/* orval:factory-operation-end */';

/** Marks a shared-style operation to be moved into the factory closure. */
export const markFactoryOperation = (implementation: string) =>
  `${FACTORY_OPERATION_START}\n${implementation}${FACTORY_OPERATION_END}\n`;

/**
 * Splits shared-style output into its module-level declarations and the
 * marked operations, which are placed inside the factory closure.
 */
export const hoistFactoryOperations = (source: string, title: string) => {
  const [moduleLevel, ...rest] = source.split(FACTORY_OPERATION_START);
  const declarations = [moduleLevel];
  const operations: string[] = [];
  for (const chunk of rest) {
    const [operation, after = ''] = chunk.split(FACTORY_OPERATION_END);
    operations.push(operation.replace(/^\n/, ''));
    declarations.push(after.replace(/^\n/, ''));
  }
  const operationSource = operations.join('\n');
  // A parameter named `fetchFn` would shadow the factory argument inside its
  // operation, so the argument is then read through a name no operation uses.
  const fetchName = /\bfetchFn\b/.test(source)
    ? getUniqueName(
        'factoryFetchFn',
        new Set(source.match(/\bfactoryFetchFn\d*\b/g)),
      )
    : 'fetchFn';
  const capture =
    fetchName === 'fetchFn' ? '' : `const ${fetchName} = fetchFn;\n\n`;

  return `${declarations.join('')}\n${getFactoryOpening(title)}${capture}${operationSource.replaceAll(FACTORY_FETCH_REFERENCE, fetchName)}`;
};

/**
 * Closes the factory closure by returning its operations and URL helpers, then
 * emits the response types the client builder kept outside of it.
 */
export const getFactoryClosing = ({
  operationNames,
  operations,
  isSharedRuntime,
}: {
  operationNames: string[];
  operations?: GeneratorOperation[];
  isSharedRuntime: boolean;
}) => {
  // Hook mutators declare `use{Op}Hook` instead of the operation itself; the
  // shared runtime ignores them, so its operations keep their own names.
  const returnedNames = operations
    ? operations.flatMap(({ operationName, mutator }) => [
        mutator?.isHook && !isSharedRuntime
          ? `use${pascal(operationName)}Hook`
          : operationName,
        camel(`get-${operationName}-url`),
      ])
    : operationNames;
  const responseTypes = (operations ?? [])
    .map((operation) => operation.types?.result())
    .filter(Boolean)
    .join('\n');

  return `return { ${returnedNames.join(', ')} };\n};\n${responseTypes ? `\n${responseTypes}\n` : ''}`;
};
