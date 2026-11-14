import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import type {
  ContextSpec,
  GeneratorClient,
  GeneratorOptions,
  GeneratorVerbOptions,
  NormalizedFormatTypeMap,
  OpenApiParameterObject,
  OpenApiResponseObject,
  OpenApiSchemaObject,
} from '@orval/core';
import { Effect, Schema as S } from 'effect';
import ts from 'typescript';

import { generateEffect } from '.';
import { createTestContextSpec } from '../../core/src/test-utils';
import { generateEffectComponents } from './reusable-schemas';

export const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

export type Schemas = Record<string, OpenApiSchemaObject>;

export interface Scenario {
  schemas: Schemas;
  // The schema of the request body, or of the response.
  schema: OpenApiSchemaObject;
  target?: 'body' | 'response';
  contentType?: string;
  useDates?: boolean;
  exactOptional?: boolean;
  useBrandedTypes?: boolean;
  formatType?: NormalizedFormatTypeMap;
  parameters?: OpenApiParameterObject[];
  // Responses the generator does not render, next to the 200 one.
  otherResponses?: Record<string, OpenApiResponseObject>;
}

// Generated TypeScript as a script `runInNewContext` can run: types removed,
// exports dropped. Throws on a syntax error, which TypeScript would repair.
const scriptOf = (code: string): string => {
  const { outputText, diagnostics = [] } = ts.transpileModule(code, {
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.Preserve,
    },
  });
  if (diagnostics.length > 0) {
    throw new Error(`Generated code has syntax errors:\n${code}`);
  }
  return outputText
    .replaceAll(/^export /gm, '')
    .replaceAll(/^import .*$/gm, '');
};

const contextOf = (scenario: Scenario, enabled: boolean) => {
  const { schemas, schema, target = 'body', useDates = false } = scenario;
  const content = {
    [scenario.contentType ?? 'application/json']: { schema },
  };
  return createTestContextSpec({
    spec: {
      paths: {
        '/pets': {
          post: {
            parameters: scenario.parameters,
            ...(target === 'body' ? { requestBody: { content } } : {}),
            responses: {
              '200': {
                description: 'ok',
                ...(target === 'response' ? { content } : {}),
              },
              ...scenario.otherResponses,
            },
          },
        },
      },
      components: { schemas },
    },
    output: {
      override: {
        useDates,
        formatType: scenario.formatType,
        effect: {
          version: 4,
          generateReusableSchemas: enabled,
          exactOptional: scenario.exactOptional ?? false,
          useBrandedTypes: scenario.useBrandedTypes ?? false,
          generate: {
            param: true,
            query: true,
            header: true,
            body: true,
            response: true,
          },
        },
      },
    },
  });
};

/** What the generator returns for the operation of a scenario. */
export const generateOperation = async (
  scenario: Scenario,
  enabled: boolean,
): Promise<GeneratorClient & { context: ContextSpec }> => {
  const context = contextOf(scenario, enabled);
  const { implementation, imports } = await generateEffect(
    {
      typeName: 'createPets',
      operationName: 'createPets',
      verb: 'post',
      override: context.output.override,
    } as GeneratorVerbOptions,
    { pathRoute: '/pets', context } as GeneratorOptions,
    'effect',
  );
  return { context, implementation, imports };
};

/** The component constants, if enabled, and the operation constants. */
export const generateModule = async (
  scenario: Scenario,
  enabled: boolean,
): Promise<string> => {
  const { context, implementation, imports } = await generateOperation(
    scenario,
    enabled,
  );
  const used = new Set(
    imports.flatMap(({ name, schemaName }) => (schemaName ? [name] : [])),
  );
  return `${enabled ? generateEffectComponents(context, used) : ''}\n${implementation}`;
};

const isCodec = (value: unknown): value is S.Codec<unknown> =>
  S.isSchema(value);

/** Evaluates generated code against the real `effect`. */
export const evaluate = (code: string, name: string): S.Codec<unknown> => {
  const value: unknown = runInNewContext(scriptOf(`${code}\n;${name}`), {
    S,
    Effect,
    File,
    Date,
  });
  if (!isCodec(value)) throw new Error(`${name} is not a schema`);
  return value;
};

// A file beside the sources, so `effect` resolves. TypeScript names files with
// forward slashes.
const PROBE_FILE = fileURLToPath(
  new URL('probe.generated.ts', import.meta.url),
).replaceAll('\\', '/');

/**
 * Type errors of generated component code, which declares a type and an
 * encoded type for each constant on a cycle. Each declared type must be the
 * type its schema decodes to, and the declared encoded type the one it accepts:
 * a wider one still compiles but hands users a type that is too loose.
 */
export const declaredTypeErrors = (components: string): string[] => {
  const pairs = [
    ...components.matchAll(/^export type (\w+) = .*\nexport type (\w+) = /gm),
  ];
  const source = [
    "import { Schema as S } from 'effect';",
    components,
    "type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : 'declared type is wider') : 'declared type is narrower';",
    ...pairs.flatMap(([, type, encoded]) => [
      `export const ${type}Type: Same<S.Schema.Type<typeof ${type}>, ${type}> = true;`,
      `export const ${type}Accepts: Same<S.Codec.Encoded<typeof ${type}>, ${encoded}> = true;`,
    ]),
  ].join('\n');
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    types: [],
  };
  const base = ts.createCompilerHost(options);
  const host: ts.CompilerHost = {
    ...base,
    getSourceFile: (name, ...rest) =>
      name === PROBE_FILE
        ? ts.createSourceFile(name, source, ts.ScriptTarget.ES2022)
        : base.getSourceFile(name, ...rest),
    readFile: (name) => (name === PROBE_FILE ? source : base.readFile(name)),
    fileExists: (name) => name === PROBE_FILE || base.fileExists(name),
  };
  const program = ts.createProgram([PROBE_FILE], options, host);
  return ts.getPreEmitDiagnostics(program).map(({ messageText, start }) => {
    const text = ts.flattenDiagnosticMessageText(messageText, '\n');
    const line = source.slice(0, start ?? 0).split('\n').length;
    return `${text} (line ${line}: ${source.split('\n')[line - 1]})`;
  });
};
