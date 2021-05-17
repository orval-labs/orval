import { OpenAPIObject } from 'openapi3-ts';
import swagger2openapi from 'swagger2openapi';

export const swaggerConverter = async (
  schema: any,
  options: swagger2openapi.Options = {},
  ref: string,
): Promise<OpenAPIObject> => {
  try {
    return await new Promise((resolve, reject) => {
      if (!schema.openapi || !schema.openapi.startsWith('3.0')) {
        swagger2openapi.convertObj(schema, options, (err, spec) => {
          if (err) {
            reject(err);
          } else {
            resolve(spec.openapi);
          }
        });
      } else {
        resolve(schema);
      }
    });
  } catch (e) {
    throw `Oups... 🍻.\nPath: ${ref}\nParsing Error: ${e}`;
  }
};
