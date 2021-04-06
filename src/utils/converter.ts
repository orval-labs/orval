import { OpenAPIObject } from 'openapi3-ts';
import swagger2openapi from 'swagger2openapi';

export const swaggerConverter = (schema: any): Promise<OpenAPIObject> => {
  try {
    return new Promise((resolve, reject) => {
      if (!schema.openapi || !schema.openapi.startsWith('3.0')) {
        swagger2openapi.convertObj(schema, {}, (err, { openapi }) => {
          if (err) {
            reject(err);
          } else {
            resolve(openapi);
          }
        });
      } else {
        resolve(schema);
      }
    });
  } catch (e) {
    throw `Oups... 🍻. Parsing Error: ${e}`;
  }
};
