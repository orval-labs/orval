import type { BoundRefinement } from '@orval/core';
import globals from 'globals';
import * as ts from 'typescript';

/**
 * Globals that exist in a generated JavaScript module. Because parsing is done
 * without a TypeScript lib, these are treated as known external names.
 * Project-specific globals must instead be supplied as explicit bindings.
 */
const JAVASCRIPT_GLOBALS = new Set(Object.keys(globals.builtin));

/**
 * An identifier is a reference unless it occupies a purely syntactic position
 * such as the name in `object.property`, `{ property: value }`, or a label.
 * Shorthand properties (`{ property }`) are references and handled separately.
 */
const isReferenceIdentifier = (node: ts.Identifier): boolean => {
  const parent = node.parent;
  if (
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    (ts.isPropertyAssignment(parent) && parent.name === node) ||
    (ts.isBindingElement(parent) && parent.propertyName === node) ||
    (ts.isMethodDeclaration(parent) && parent.name === node) ||
    (ts.isPropertyDeclaration(parent) && parent.name === node) ||
    (ts.isGetAccessorDeclaration(parent) && parent.name === node) ||
    (ts.isSetAccessorDeclaration(parent) && parent.name === node) ||
    (ts.isLabeledStatement(parent) && parent.label === node) ||
    ((ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) &&
      parent.label === node)
  ) {
    return false;
  }
  return true;
};

/**
 * Cache that stores free identifiers found by findFreeIdentifiers
 */
const freeIdentifierCache = new Map<string, string[]>();

/**
 * Find true free identifiers using the TS binder's lexical resolution rather
 * than regular expressions. This handles shadowing, destructuring, nested
 * functions, `catch`, property shorthand, and computed property names.
 */
const findFreeIdentifiers = (source: string): string[] => {
  const cached = freeIdentifierCache.get(source);
  if (cached) return cached;

  const fileName = '/__orval_serialized_callable__.ts';
  const text = `(${source});`;
  const options: ts.CompilerOptions = {
    noLib: true,
    target: ts.ScriptTarget.ES2022,
  };
  const sourceFile = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.ES2022,
    true,
  );
  const expression = (sourceFile.statements[0] as ts.ExpressionStatement)
    .expression;
  const callableNode = ts.isParenthesizedExpression(expression)
    ? expression.expression
    : expression;

  if (
    !ts.isArrowFunction(callableNode) &&
    !ts.isFunctionExpression(callableNode)
  ) {
    throw new TypeError(
      'Cannot serialize callable: expected an arrow function or function expression',
    );
  }

  // No disk reads or TypeScript standard library are needed to analyze the
  // one in-memory function expression. No user code is executed here.
  const host = ts.createCompilerHost(options);
  host.getSourceFile = (name) => (name === fileName ? sourceFile : undefined);
  host.fileExists = (name) => name === fileName;
  host.readFile = (name) => (name === fileName ? text : undefined);
  const program = ts.createProgram([fileName], options, host);
  if (program.getSyntacticDiagnostics(sourceFile).length > 0) {
    throw new SyntaxError('Cannot serialize callable: invalid function source');
  }

  const checker = program.getTypeChecker();
  const free = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      node.kind === ts.SyntaxKind.ThisKeyword ||
      node.kind === ts.SyntaxKind.SuperKeyword
    ) {
      throw new TypeError('Cannot serialize callable containing this or super');
    }
    if (
      ts.isMetaProperty(node) &&
      node.keywordToken === ts.SyntaxKind.NewKeyword
    ) {
      throw new TypeError('Cannot serialize callable containing new.target');
    }
    if (ts.isIdentifier(node) && isReferenceIdentifier(node)) {
      if (ts.isShorthandPropertyAssignment(node.parent)) {
        if (!checker.getShorthandAssignmentValueSymbol(node.parent)) {
          free.add(node.text);
        }
      } else if (!checker.getSymbolAtLocation(node)) {
        free.add(node.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(callableNode);
  const result = [...free];
  freeIdentifierCache.set(source, result);
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
  const declarations: string[] = [];
  const used = new Set<string>();
  const unresolved: string[] = [];
  for (const name of free) {
    if (name === 'arguments' || name === 'eval') {
      throw new TypeError(`Cannot serialize a closure over ${name}`);
    }
    if (Object.hasOwn(resolvedBindings, name)) {
      used.add(name);
      declarations.push(
        `  const ${name} = ${serializeCaptureValue(resolvedBindings[name])};`,
      );
    } else if (!JAVASCRIPT_GLOBALS.has(name)) {
      unresolved.push(name);
    }
  }
  if (unresolved.length > 0) {
    throw new ReferenceError(
      `Cannot serialize callable: unresolved external reference(s): ${unresolved.join(', ')}. Supply bindings for them.`,
    );
  }
  for (const name of Object.keys(resolvedBindings)) {
    if (!used.has(name)) {
      throw new TypeError(`Unused callable binding: ${name}`);
    }
  }

  return {
    predicate: predicateSource,
    options: optionsSource,
    declarations,
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
