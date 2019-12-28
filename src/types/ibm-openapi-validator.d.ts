declare module "ibm-openapi-validator" {
  interface OpenAPIError {
    path: string;
    message: string;
  }

  interface ValidatorResults {
    errors: OpenAPIError[];
    warnings: OpenAPIError[];
  }

  /**
   * Returns a Promise with the validation results.
   *
   * @param openApiDoc An object that represents an OpenAPI document.
   * @param defaultMode If set to true, the validator will ignore the .validaterc file and will use the configuration defaults.
   */
  function validator(openApiDoc: any, defaultMode = false): Promise<ValidatorResults>;

  export default validator;
}
