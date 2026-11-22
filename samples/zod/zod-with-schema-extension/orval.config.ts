import { type OpenApiSchemaObject, defineConfig } from "orval";
import { isDecimalWithPrecision } from "./decimal-validator";

/** A non-boolean schema carrying the vendor extension this sample validates. */
type DecimalSchemaObject = Exclude<OpenApiSchemaObject, boolean> & {
  "x-max-precision"?: number;
};

export default defineConfig({
  petstore: {
    input: {
      target: "./petstore.yaml",
    },
    output: {
      client: "zod",
      mode: "single",
      target: "./schemas",
      override: {
        zod: {
          // Prefer Mini for more tree-shakeable generated schemas.
          variant: "mini",
          version: 4,
          schemaExtension: [
            {
              type: "string",
              format: "decimal",
              validatorsGenerator: (openapi_object: DecimalSchemaObject) => {
                const maxPrecision = openapi_object["x-max-precision"];

                if (maxPrecision !== undefined) {
                  const validateDecimal = isDecimalWithPrecision;

                  return {
                    callable: (value: unknown) =>
                      typeof value === "string" && validateDecimal(value, maxPrecision),

                    bindings: {
                      maxPrecision,
                      $imports: [
                        "import { isDecimalWithPrecision as validateDecimal } from '../decimal-validator';",
                      ],
                    },
                  };
                }
                return null;
              },
            },
          ],
        },
      },
      formatter: "prettier",
      clean: true,
    },
  },
});
