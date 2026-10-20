import { type OpenApiSchemaObject, defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    input: {
      target: './petstore.yaml',
    },
    output: {
      client: 'zod',
      mode: 'single',
      target: './schemas',
      override: {
        zod: {
          // Prefer Mini for more tree-shakeable generated schemas.
          variant: 'mini',
          version: 4,
          schemaExtension: 
          [
            { 
              type : "string",
              format : "decimal",
              validatorsGenerator : (openapi_object : OpenApiSchemaObject) => 
              {
                if (openapi_object["x-max-precision"])
                  {
                    return {callable :  (value : unknown) => {
                      if (typeof value !== 'string' || !/^[+-]?(?:\d+(\.\d*)?|\.\d+)$/.test(value)) {
                        return false;
                      }

                    const precision = value.split('.')[1]?.length ?? 0;

                    return precision === 0 || precision <= openapi_object['x-max-precision'];}, bindings : { openapi_object : {...openapi_object} }}
                  }
                return null;
              }
            }
          ], 
        },
      },
      formatter: 'prettier',
      clean: true,
    },
  },
});