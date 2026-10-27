import { runInNewContext } from 'node:vm';

import type { OpenApiSchemaObject } from '@orval/core';
import * as v from 'valibot';

import { createTestContextSpec } from '../../core/src/test-utils';
import { renderValibot } from './render';
import { generateValibotValidationSchemaDefinition } from './schema';

// Renders a schema and evaluates it against the real `valibot`, so a test
// asserts what the output accepts and rejects, not only how it is spelled.
export const gen = (
  schema: OpenApiSchemaObject,
  options?: {
    required?: boolean;
    strict?: boolean;
    exactOptional?: boolean;
    useDates?: boolean;
  },
) => {
  const context = createTestContextSpec({
    output: { override: { useDates: options?.useDates ?? false } },
  });
  const valibot = renderValibot(
    generateValibotValidationSchemaDefinition(
      schema,
      context,
      options?.strict ?? false,
      { required: options?.required ?? true },
    ),
    { exactOptional: options?.exactOptional },
  );
  const instance = runInNewContext(valibot, {
    v,
    File,
    Date,
  }) as v.GenericSchema;
  const ok = (input: unknown) => v.safeParse(instance, input).success;
  const output = (input: unknown) => v.parse(instance, input) as unknown;
  return { valibot, ok, output };
};
