import type { BoundRefinement, GeneratorImport } from '@orval/core';
import { type Node, Parser, type Program } from 'acorn';
import { analyze } from 'eslint-scope';
import globals from 'globals';

/**
 * Globals that exist in a generated JavaScript module. These are treated as
 * known external names; project-specific globals must instead be supplied as
 * explicit bindings.
 */
const JAVASCRIPT_GLOBALS = new Set(Object.keys(globals.builtin));

/**
 * `fn.toString()` is always JavaScript (whatever transpiled the config, the
 * engine only sees JS), and the function may be sloppy-mode code.
 */
const parse = (text: string): Program =>
  Parser.parse(text, {
    ecmaVersion: 'latest',
    sourceType: 'script',
    // eslint-scope reads `range` on the nodes it analyzes.
    ranges: true,
  });

/**
 * A method (`name() {}`) or accessor (`get name() {}`) stringifies without the
 * `function` keyword, so it is not a valid expression on its own. Recognize it
 * as an object member to report the unsupported callable kind rather than a
 * syntax error.
 */
const isObjectMember = (source: string): boolean => {
  try {
    parse(`({${source}});`);
    return true;
  } catch {
    return false;
  }
};

/**
 * Reject constructs whose meaning depends on how the callable is invoked, so
 * they cannot be reproduced by re-emitting the source in another module.
 */
const assertNoReceiverReferences = (node: unknown): void => {
  if (Array.isArray(node)) {
    for (const child of node) assertNoReceiverReferences(child);
    return;
  }
  if (typeof node !== 'object' || node === null || !('type' in node)) return;

  const { type } = node as Node;
  if (type === 'ThisExpression' || type === 'Super') {
    throw new TypeError('Cannot serialize callable containing this or super');
  }
  if (
    type === 'MetaProperty' &&
    (node as Node & { meta: { name: string } }).meta.name === 'new'
  ) {
    throw new TypeError('Cannot serialize callable containing new.target');
  }

  for (const [key, child] of Object.entries(node)) {
    if (key !== 'range' && typeof child === 'object') {
      assertNoReceiverReferences(child);
    }
  }
};

/**
 * Cache that stores free identifiers found by findFreeIdentifiers
 */
const freeIdentifierCache = new Map<string, string[]>();

/**
 * Find true free identifiers using lexical scope analysis rather than regular
 * expressions. This handles shadowing, destructuring, nested functions,
 * `catch`, property shorthand, and computed property names.
 */
const findFreeIdentifiers = (source: string): string[] => {
  const cached = freeIdentifierCache.get(source);
  if (cached) return cached;

  let program: Program;
  try {
    program = parse(`(${source});`);
  } catch {
    if (isObjectMember(source)) {
      throw new TypeError(
        'Cannot serialize callable: expected an arrow function or function expression',
      );
    }
    throw new SyntaxError('Cannot serialize callable: invalid function source');
  }

  const [statement] = program.body;
  const callableNode =
    program.body.length === 1 && statement.type === 'ExpressionStatement'
      ? statement.expression
      : undefined;

  if (
    callableNode?.type !== 'ArrowFunctionExpression' &&
    callableNode?.type !== 'FunctionExpression'
  ) {
    throw new TypeError(
      'Cannot serialize callable: expected an arrow function or function expression',
    );
  }

  assertNoReceiverReferences(callableNode);

  // References that no scope inside the program resolves reach the global
  // scope unresolved; those are the callable's free identifiers. Like the
  // engine, the analysis binds `arguments` inside non-arrow functions only.
  const scopeManager = analyze(
    program as unknown as Parameters<typeof analyze>[0],
    {
      ecmaVersion: 2022,
      sourceType: 'script',
      // eslint-scope's default keys predate import attributes and skip the
      // second `import()` argument, which acorn stores as `options`.
      childVisitorKeys: { ImportExpression: ['source', 'options'] },
    },
  );
  const free = new Set<string>();
  for (const reference of scopeManager.globalScope?.through ?? []) {
    free.add(reference.identifier.name);
  }

  const result = [...free];
  freeIdentifierCache.set(source, result);
  return result;
};

/**
 * Interpret `$imports` as module-level imports, never as serializable capture
 * values. Each declaration must define at least one local runtime identifier.
 * Import syntax is parsed (not searched with a regex) so aliases, defaults,
 * and namespace imports resolve the correct free identifier.
 *
 * Module resolution remains the generated file writer's responsibility:
 * relative import paths are relative to the generated file, not orval.config.
 */
export const getRefinementImports = (
  descriptor: Pick<BoundRefinement, 'bindings'>,
): GeneratorImport[] => {
  const imports = descriptor.bindings?.$imports;
  if (imports === undefined) return [];
  if (
    !Array.isArray(imports) ||
    !imports.every((item: unknown): item is string => typeof item === 'string')
  ) {
    throw new TypeError(
      'Callable $imports must be an array of import statements',
    );
  }

  const result: GeneratorImport[] = [];
  const localNames = new Set<string>();
  for (const source of imports) {
    let program: Program;
    try {
      program = Parser.parse(source, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ranges: true,
      });
    } catch {
      throw new SyntaxError(`Invalid callable import statement: ${source}`);
    }

    const [statement] = program.body;
    if (program.body.length !== 1 || statement.type !== 'ImportDeclaration') {
      throw new TypeError(
        'Callable $imports entries must be static import declarations',
      );
    }
    if (statement.specifiers.length === 0) {
      throw new TypeError(
        'Side-effect-only callable imports are not supported',
      );
    }
    const importPath = statement.source.value;
    if (typeof importPath !== 'string') {
      throw new TypeError('Callable import source must be a string');
    }

    for (const specifier of statement.specifiers) {
      const localName = specifier.local.name;
      if (localName === 'zod') {
        throw new TypeError('Callable imports cannot shadow the Zod namespace');
      }
      if (localNames.has(localName)) {
        throw new TypeError(
          `Duplicate imported callable identifier: ${localName}`,
        );
      }
      localNames.add(localName);

      if (specifier.type === 'ImportDefaultSpecifier') {
        result.push({
          name: localName,
          importPath,
          default: true,
          values: true,
        });
      } else if (specifier.type === 'ImportNamespaceSpecifier') {
        result.push({
          name: localName,
          importPath,
          namespaceImport: true,
          values: true,
        });
      } else {
        const importedName =
          specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value;
        if (
          typeof importedName !== 'string' ||
          !/^[$A-Z_a-z][$\w]*$/.test(importedName)
        ) {
          throw new TypeError(
            'Callable imports require identifier-named exports',
          );
        }
        result.push({
          name: importedName,
          ...(localName === importedName ? {} : { alias: localName }),
          importPath,
          values: true,
        });
      }
    }
  }
  return result;
};

/**
 * Serialize JSON-like capture values without evaluating accessors/toJSON or
 * silently dropping unsupported values. Supports extra JS literals that JSON
 * cannot represent (undefined, bigint, NaN, infinities, RegExp and Date).
 */
const serializeCaptureValue = (
  value: unknown,
  active = new Set<object>(),
  onFunction?: (value: (...args: never[]) => unknown) => string,
): string => {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return String(value);
    case 'undefined':
      return 'undefined';
    case 'bigint':
      return `${value}n`;
    case 'number':
      if (Number.isNaN(value)) return 'NaN';
      if (value === Infinity) return 'Infinity';
      if (value === -Infinity) return '-Infinity';
      if (Object.is(value, -0)) return '-0';
      return String(value);
    case 'function':
      if (onFunction) return onFunction(value as (...args: never[]) => unknown);
      throw new TypeError('Cannot serialize captured function');
    case 'symbol':
      throw new TypeError('Cannot serialize captured symbol');
  }

  if (value instanceof RegExp) {
    if (value.lastIndex !== 0) {
      throw new TypeError(
        'Cannot serialize captured RegExp with nonzero lastIndex',
      );
    }
    return `new RegExp(${JSON.stringify(value.source)}, ${JSON.stringify(value.flags)})`;
  }
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) {
      throw new TypeError('Cannot serialize invalid captured Date');
    }
    return `new Date(${value.getTime()})`;
  }
  if (active.has(value)) {
    throw new TypeError('Cannot serialize cyclic captured value');
  }

  active.add(value);
  try {
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new TypeError('Cannot serialize captured symbol-keyed properties');
    }
    if (Array.isArray(value)) {
      const entries: string[] = [];
      for (let index = 0; index < value.length; index++) {
        if (!Object.hasOwn(value, index)) {
          throw new TypeError('Cannot serialize sparse captured array');
        }
        const descriptor = Object.getOwnPropertyDescriptor(
          value,
          index.toString(),
        );
        if (!descriptor || !('value' in descriptor)) {
          throw new TypeError('Cannot serialize captured accessor');
        }
        entries.push(
          serializeCaptureValue(descriptor.value, active, onFunction),
        );
      }
      if (Reflect.ownKeys(value).length !== value.length + 1) {
        throw new TypeError(
          'Cannot serialize captured array with extra properties',
        );
      }
      return `[${entries.join(', ')}]`;
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new TypeError('Cannot serialize captured non-plain object');
    }
    const entries: string[] = [];
    if (Reflect.ownKeys(value).length !== Object.keys(value).length) {
      throw new TypeError(
        'Cannot serialize captured non-enumerable properties',
      );
    }
    for (const key of Object.keys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) {
        throw new TypeError('Cannot serialize captured accessor');
      }
      // A bare `"__proto__": ...` object-literal key is not a data property.
      const property =
        key === '__proto__' ? `[${JSON.stringify(key)}]` : JSON.stringify(key);
      entries.push(
        `${property}: ${serializeCaptureValue(descriptor.value, active, onFunction)}`,
      );
    }
    return `{ ${entries.join(', ')} }`;
  } finally {
    active.delete(value);
  }
};

/**
 * Serialize a refinement and its optional Zod `.refine()` second argument.
 * Functions anywhere inside `options` share the predicate's captured bindings.
 * Nothing is invoked during code generation; all functions are emitted as source.
 *
 * Without options, the original single-expression representation is retained.
 * With options, an argument fragment is returned (possibly using a spread IIFE
 * to declare captured values once for both arguments).
 */
/**
 * Keep captured declarations separate from callable arguments so the emitter
 * can place the binding scope around the whole Zod expression. This preserves
 * contextual typing for both the predicate and options callbacks.
 */
export interface SerializedCallableParts {
  predicate: string;
  options?: string;
  declarations: string[];
  /** Runtime imports to be added to the generated file's import list. */
  imports?: GeneratorImport[];
}

export const serializeCallableParts = (
  descriptor: BoundRefinement,
): SerializedCallableParts => {
  const { callable, options, bindings } = descriptor;

  if (typeof callable !== 'function') {
    throw new TypeError('RefinementDescriptor.callable must be a function');
  }

  const free = new Set<string>();
  const serializeFunction = (fn: (...args: never[]) => unknown): string => {
    const source = fn.toString();
    if (source.includes('[native code]')) {
      throw new TypeError('Cannot serialize a native callable as a refinement');
    }
    for (const name of findFreeIdentifiers(source)) {
      free.add(name);
    }
    return `(${source})`;
  };

  const predicateSource = serializeFunction(callable);
  const optionsSource =
    options === undefined
      ? undefined
      : serializeCaptureValue(options, new Set<object>(), serializeFunction);

  const resolvedBindings = bindings ?? {};
  const imports = getRefinementImports(descriptor);
  const importedNames = new Set(imports.map((item) => item.alias ?? item.name));
  const declarations: string[] = [];
  const used = new Set<string>();
  const usedImports = new Set<string>();
  const unresolved: string[] = [];
  for (const name of free) {
    if (name === 'arguments' || name === 'eval') {
      throw new TypeError(`Cannot serialize a closure over ${name}`);
    }
    if (Object.hasOwn(resolvedBindings, name) && name !== '$imports') {
      if (importedNames.has(name)) {
        throw new TypeError(`Callable binding conflicts with import: ${name}`);
      }
      used.add(name);
      declarations.push(
        `  const ${name} = ${serializeCaptureValue(resolvedBindings[name])};`,
      );
    } else if (importedNames.has(name)) {
      usedImports.add(name);
    } else if (!JAVASCRIPT_GLOBALS.has(name)) {
      unresolved.push(name);
    }
  }
  if (unresolved.length > 0) {
    throw new ReferenceError(
      `Cannot serialize callable: unresolved external reference(s): ${unresolved.join(', ')}. Supply bindings or $imports for them.`,
    );
  }
  for (const name of Object.keys(resolvedBindings)) {
    if (name !== '$imports' && !used.has(name)) {
      throw new TypeError(`Unused callable binding: ${name}`);
    }
  }
  for (const name of importedNames) {
    if (Object.hasOwn(resolvedBindings, name) && name !== '$imports') {
      throw new TypeError(`Callable binding conflicts with import: ${name}`);
    }
    if (!usedImports.has(name)) {
      throw new TypeError(`Unused callable import: ${name}`);
    }
  }

  return {
    predicate: predicateSource,
    options: optionsSource,
    declarations,
    ...(imports.length > 0 ? { imports } : {}),
  };
};

/**
 * Standalone legacy serializer. The complete-expression emitter should instead
 * use `serializeCallableParts` to retain TypeScript contextual typing.
 */
export const serializeCallable = (descriptor: BoundRefinement): string => {
  const { predicate, options, declarations } =
    serializeCallableParts(descriptor);
  if (options === undefined) {
    if (declarations.length === 0) return predicate;
    return `(() => {\n${declarations.join('\n')}\n  return ${predicate};\n})()`;
  }

  const args = `${predicate}, ${options}`;
  if (declarations.length === 0) return args;
  return `...(() => {\n${declarations.join('\n')}\n  return [${args}] as const;\n})()`;
};
