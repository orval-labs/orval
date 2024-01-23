import chalk from 'chalk';
import { OpenAPIObject } from 'openapi3-ts/oas30';
import swagger2openapi from 'swagger2openapi';
import { log } from './logger';

export const openApiConverter = async (
  schema: any,
  options: swagger2openapi.Options = {},
  specKey: string,
): Promise<OpenAPIObject> => {
  try {
    return new Promise((resolve) => {
      if (!schema.openapi && schema.swagger === '2.0') {
        swagger2openapi.convertObj(schema, options, (err, value) => {
          if (err) {
            log(chalk.yellow(`${specKey}\n=> ${err}`));
            resolve(schema);
          } else {
            resolve(value.openapi);
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
