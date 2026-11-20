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
import { Schema as S3 } from 'effect3';

import { generateEffect } from '.';
import { createTestContextSpec } from '../../core/src/test-utils';
import {
  toScript,
  typeCheckDiagnostics,
} from '../../core/src/test-utils/typescript';
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
// exports and imports dropped. Throws on a syntax error instead of running
// repaired code.
const scriptOf = (code: string): string => {
  let script: string;
  try {
    script = toScript(code);
  } catch (error) {
    throw new Error(`Generated code has syntax errors:\n${code}`, {
      cause: error,
    });
  }
  return script.replaceAll(/^import .*$/gm, '');
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

const isCodecV3 = (value: unknown): value is S3.Schema<unknown> =>
  S3.isSchema(value);

/** Evaluates generated code against the real `effect` 3. */
export const evaluateV3 = (code: string, name: string): S3.Schema<unknown> => {
  const value: unknown = runInNewContext(scriptOf(`${code}\n;${name}`), {
    S: S3,
    File,
    Date,
  });
  if (!isCodecV3(value)) throw new Error(`${name} is not a schema`);
  return value;
};

// Type-check beside the sources, so `effect` resolves.
const SOURCE_DIR = fileURLToPath(new URL('.', import.meta.url));

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
  const diagnostics = typeCheckDiagnostics(
    { 'probe.generated.ts': source },
    {
      tempParent: SOURCE_DIR,
      compilerOptions: {
        strict: true,
        skipLibCheck: true,
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        types: [],
      },
    },
  );
  return diagnostics.map(({ message, line = 1 }) => {
    return `${message} (line ${line}: ${source.split('\n')[line - 1]})`;
  });
};
