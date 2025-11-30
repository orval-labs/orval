import {
  type NormalizedOptions,
  type OpenApiDocument,
  type WriteSpecBuilder,
} from '@orval/core';
import { bundle } from '@scalar/json-magic/bundle';
import {
  fetchUrls,
  parseJson,
  parseYaml,
  readFiles,
} from '@scalar/json-magic/bundle/plugins/node';
import { upgrade, validate as validateSpec } from '@scalar/openapi-parser';

import { importOpenApi } from './import-open-api';

async function resolveSpec(
  input: string | Record<string, unknown>,
): Promise<OpenApiDocument> {
  const data = await bundle(input, {
    plugins: [readFiles(), fetchUrls(), parseJson(), parseYaml()],
    treeShake: true,
  });

  const { valid, errors } = await validateSpec(data);
  if (!valid) {
    throw new Error('Validation failed', { cause: errors });
  }

  const { specification } = upgrade(data);

  return specification;
}

export async function importSpecs(
  workspace: string,
  options: NormalizedOptions,
): Promise<WriteSpecBuilder> {
  const { input, output } = options;

  const spec = await resolveSpec(input.target);

  return importOpenApi({
    spec,
    input,
    output,
    target: input.target,
    workspace,
  });
}
