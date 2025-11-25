// import SwaggerParser from '@apidevtools/swagger-parser';
import {
  isString,
  isUrl,
  type NormalizedOptions,
  type OpenApiDocument,
  type SwaggerParserOptions,
  type WriteSpecsBuilder,
} from '@orval/core';
import { bundle } from '@scalar/json-magic/bundle';
import {
  fetchUrls,
  parseJson,
  parseYaml,
  readFiles,
} from '@scalar/json-magic/bundle/plugins/node';
import {
  dereference,
  upgrade,
  validate as validateSpec,
} from '@scalar/openapi-parser';

// import chalk from 'chalk';
// import fs from 'fs-extra';
// import yaml from 'js-yaml';
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

async function resolveSpecs(
  path: string,
  { validate, ...options }: SwaggerParserOptions,
  _isUrl: boolean,
  isOnlySchema: boolean,
): Promise<Record<string, OpenApiDocument>> {
  const data = await bundle(path, {
    plugins: [readFiles(), fetchUrls(), parseJson(), parseYaml()],
    treeShake: true,
  });
  if (validate) {
    const { valid, errors } = await validateSpec(data);
    if (!valid) {
      throw new Error('Validation failed', { cause: errors });
    }
  }
  const { specification } = upgrade(data);
  // const { specification: deref } = await dereference(specification);

  return { [path]: specification };

  // try {
  //   if (validate) {
  //     try {
  //       await SwaggerParser.validate(path, options);
  //     } catch (error) {
  //       if (error instanceof Error && error.name === 'ParserError') {
  //         throw error;
  //       }

  //       if (!isOnlySchema) {
  //         log(`⚠️  ${chalk.yellow(error)}`);
  //       }
  //     }
  //   }

  //   const data = (await SwaggerParser.resolve(path, options)).values();

  //   if (_isUrl) {
  //     return data;
  //   }

  //   // normalizing slashes after SwaggerParser
  //   return Object.fromEntries(
  //     Object.entries(data)
  //       .sort()
  //       .map(([key, value]) => [isUrl(key) ? key : upath.resolve(key), value]),
  //   );
  // } catch {
  //   const file = await fs.readFile(path, 'utf8');

  //   return {
  //     [path]: yaml.load(file),
  //   };
  // }
}

export async function importSpecs(
  workspace: string,
  options: NormalizedOptions,
): Promise<WriteSpecsBuilder> {
  const { input, output } = options;

  // if (!isString(input.target)) {
  //   return importOpenApi({
  //     data: { [workspace]: input.target },
  //     input,
  //     output,
  //     target: workspace,
  //     workspace,
  //   });
  // }

  // const isPathUrl = isUrl(input.target);

  const spec = await resolveSpec(input.target);

  return importOpenApi({
    spec,
    input,
    output,
    target: input.target,
    workspace,
  });
}
