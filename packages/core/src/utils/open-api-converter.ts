import chalk from 'chalk';
import { OpenAPIObject } from 'openapi3-ts/oas30';
import { type ConvertInputOptions, convertObj } from 'swagger2openapi';
import { log } from './logger';

export const openApiConverter = async (
  schema: any,
  options: Partial<ConvertInputOptions> = {},
  specKey: string,
): Promise<OpenAPIObject> => {
  try {
    return new Promise((resolve) => {
      if (!schema.openapi && schema.swagger === '2.0') {
        convertObj(schema, options, (err, value) => {
          if (err) {
            log(chalk.yellow(`${specKey}\n=> ${err}`));
            resolve(schema);
          } else {
            resolve(value.openapi as OpenAPIObject);
          }
        });
      } else {
        resolve(schema);
      }
    });
  } catch (e) {
    throw `Oups... 🍻.\nPath: ${specKey}\nParsing Error: ${e}`;
  }
};
