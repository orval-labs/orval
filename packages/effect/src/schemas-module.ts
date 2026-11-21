import {
  allocateDerivedNames,
  assertNoOutputTypeClash,
  collectOperationSchemas,
  compareVersions,
  type ContextSpec,
  type GeneratorSchema,
  type GeneratorVerbOptions,
  getImportedNames,
  type NormalizedOutputOptions,
  resolveIsEffectV4,
} from '@orval/core';

import { parseEffectValidationSchemaDefinition } from '.';
import { startRun } from './logger';
import { collectRefNames, getExportNames } from './refs';
import {
  type EffectComponentConst,
  generateEffectComponentConsts,
} from './reusable-schemas';
import { EFFECT_PARSERS } from './schema-parsers';

interface EffectSchemasModuleInput {
  spec: ContextSpec['spec'];
  target: string;
  schemas: GeneratorSchema[];
  verbOptions: Record<string, GeneratorVerbOptions>;
}

interface SchemaEntry extends EffectComponentConst {
  /** The name clients import. */
  exportName: string;
}

interface RenderedEntry {
  /** What the constant needs declared before the ones that read it. */
  declaration: string;
  /** What exports it, when that has to wait for its cycle to be declared. */
  exported: string;
}

const HOISTED_CONST = /^export const ([\w$]+)/gm;

// Each identifier a schema declares in the module scope: its own, the constant
// its getters read, and the constants it hoists.
const declaredNames = ({ name, base, consts }: SchemaEntry): string[] => [
  name,
  ...(base === undefined ? [] : [base]),
  ...[...consts.matchAll(HOISTED_CONST)].map(([, hoisted]) => hoisted),
];

/**
 * Rejects a module that declares one identifier twice. Components and
 * operation schemas share the scope with the constants they hoist, which a
 * check of the names of each group alone does not see.
 */
const assertNoDeclaredNameClash = (
  groups: readonly (readonly [string, readonly SchemaEntry[]])[],
): void => {
  const declaredBy = new Map<string, string>();
  for (const [kind, entries] of groups) {
    for (const entry of entries) {
      const owner = `${kind} ${entry.exportName}`;
      for (const declared of declaredNames(entry)) {
        const own = declared === entry.name;
        const description = own ? owner : `the constant generated for ${owner}`;
        const earlier = declaredBy.get(declared);
        if (earlier !== undefined) {
          throw new Error(
            `[orval/effect] schemas.type "effect" declares "${declared}" twice: as ${earlier} and as ${description}. Rename one in the OpenAPI source.`,
          );
        }
        declaredBy.set(declared, description);
      }
    }
  }
};

// Before Effect 3.15 `standardSchemaV1` returns a validator and not a schema,
// so a constant wrapped by it cannot be a field, an item or a member.
const MIN_EFFECT_3_VERSION = '3.15.0';

const assertEffect3WrapsSchemas = (installed: string | undefined): void => {
  if (
    installed !== undefined &&
    !compareVersions(installed, MIN_EFFECT_3_VERSION)
  ) {
    throw new Error(
      `[orval/effect] schemas.type "effect" needs Effect 3.15 or newer, but ${installed} is installed. Upgrade effect, or use Effect 4.`,
    );
  }
};

// The Standard Schema wrapper keeps the schema type, so the constants compose.
// Effect 3's wrapper builds its parser at once, which reads every getter below
// the schema: a constant on a cycle is declared unwrapped and wrapped later.
const renderEntry = (isEffectV4: boolean) => {
  const wrap = isEffectV4 ? 'toStandardSchemaV1' : 'standardSchemaV1';
  const encoded = `S.${isEffectV4 ? 'Codec' : 'Schema'}.Encoded`;
  return ({
    name,
    exportName,
    consts,
    expression,
    types,
    base,
  }: SchemaEntry): RenderedEntry => {
    const exported = [
      `export const ${name} = S.${wrap}(${base ?? expression});`,
      `export type ${types?.encodedName ?? name} = ${types?.encoded ?? `${encoded}<typeof ${name}>`};`,
      `export type ${types?.typeName ?? `${exportName}Output`} = ${types?.type ?? `S.Schema.Type<typeof ${name}>`};`,
      ...(name === exportName ? [] : [`export { ${name} as ${exportName} };`]),
    ].join('\n');
    return base === undefined
      ? {
          declaration: [consts, exported].filter(Boolean).join('\n\n'),
          exported: '',
        }
      : {
          declaration: [consts, `const ${base} = ${expression};`]
            .filter(Boolean)
            .join('\n\n'),
          exported,
        };
  };
};

/**
 * The module `schemas: { type: 'effect' }` writes: the component constants in
 * dependency order, then the operation schemas clients import. Every schema is
 * wrapped as a Standard Schema, and exports its `X` encoded and `XOutput`
 * decoded types. A component that cannot be generated is left out, unless an
 * operation or a client reaches it. Empty when there is nothing to declare.
 */
export const generateEffectSchemasModule = (
  { spec, target, schemas, verbOptions }: EffectSchemasModuleInput,
  output: NormalizedOutputOptions,
  workspace: string,
): string => {
  const context: ContextSpec = { spec, target, workspace, output };
  startRun(spec);
  const isEffectV4 = resolveIsEffectV4(
    output.override.effect.version,
    output.packageJson,
  );
  if (!isEffectV4) {
    assertEffect3WrapsSchemas(output.packageJson?.resolvedVersions?.effect);
  }
  const verbs = Object.values(verbOptions);

  // A constant is declared under another name only when its own would shadow
  // what generated code relies on; clients still import it by its own name.
  const exportNames = getExportNames(context);
  // A component is reserved under the name clients import and under the name
  // its constant is declared as, which differ for names such as `Date`.
  const components = new Set([...exportNames].flat());
  const operations = collectOperationSchemas({
    parsers: EFFECT_PARSERS,
    context,
    verbs,
    schemas,
    components,
  }).map(({ name, node, exactOptional }) => ({
    name,
    node,
    ...parseEffectValidationSchemaDefinition(
      node,
      context,
      false,
      undefined,
      exactOptional,
      isEffectV4,
      undefined,
      undefined,
      undefined,
      name,
    ),
  }));

  // What an operation reads, or a client imports, has to be generated.
  const imported = new Set(verbs.flatMap(getImportedNames));
  const required = new Set([
    ...operations.flatMap(({ node }) => [...collectRefNames(node)]),
    ...[...exportNames].flatMap(([constName, exportName]) =>
      imported.has(exportName) ? [constName] : [],
    ),
  ]);
  const bases = allocateDerivedNames(
    exportNames.keys(),
    new Set([...components, ...operations.map(({ name }) => name)]),
    'Base',
  );
  // The module names each schema's encoded type like its constant and its
  // decoded type `<Name>Output`, so a recursive getter is typed the same way.
  const componentEntries: SchemaEntry[] = generateEffectComponentConsts(
    context,
    {
      required,
      typeNamesOf: (constName) => ({
        type: `${exportNames.get(constName) ?? constName}Output`,
        encoded: constName,
      }),
      baseOf: isEffectV4
        ? undefined
        : (constName) => bases.get(constName) ?? constName,
    },
  ).map((component) => ({
    ...component,
    exportName: exportNames.get(component.name) ?? component.name,
  }));
  const operationEntries: SchemaEntry[] = operations.map(
    ({ name, effect, consts }) => ({
      name,
      exportName: name,
      consts,
      expression: effect || 'S.Unknown',
    }),
  );

  assertNoDeclaredNameClash([
    ['component', componentEntries],
    ['operation schema', operationEntries],
  ]);

  const entries = [...componentEntries, ...operationEntries];
  assertNoOutputTypeClash(
    'effect',
    entries.map(({ exportName }) => exportName),
    new Set(entries.flatMap(({ name, exportName }) => [name, exportName])),
  );
  if (entries.length === 0) return '';

  const render = renderEntry(isEffectV4);
  const declared = componentEntries.map(render);
  const body = [
    ...declared.map(({ declaration }) => declaration),
    ...declared.map(({ exported }) => exported),
    ...operationEntries.map((entry) => render(entry).declaration),
  ]
    .filter(Boolean)
    .join('\n\n');
  return `import { ${body.includes('Effect.succeed(') ? 'Effect, ' : ''}Schema as S } from 'effect';\n\n${body}\n`;
};
