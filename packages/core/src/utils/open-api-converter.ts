import chalk from 'chalk';
import type { OpenAPIObject } from 'openapi3-ts/oas30';
import { type ConvertInputOptions, convertObj } from 'swagger2openapi';

import { log } from './logger';

export async function openApiConverter(
  schema: any,
  options: Partial<ConvertInputOptions> = {},
  specKey: string,
): Promise<OpenAPIObject> {
  try {
    return await new Promise<OpenAPIObject>((resolve) => {
      if (!schema.openapi && schema.swagger === '2.0') {
        convertObj(schema, options, (err, value) => {
          if (err) {
            log(chalk.yellow(`${specKey}\n=> ${err}`));
            resolve(schema as OpenAPIObject);
          } else {
            resolve(value.openapi as OpenAPIObject);
          }
        });
      } else {
        resolve(schema as OpenAPIObject);
      }
    });
  } catch (error) {
    throw new Error(`Oups... 🍻.\nPath: ${specKey}\nParsing Error: ${error}`);
  }
}
