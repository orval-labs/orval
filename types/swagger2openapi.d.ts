declare module 'swagger2openapi' {
  import { OpenAPIObject } from 'openapi3-ts/oas30';
  interface ConverObjCallbackData {
    openapi: OpenAPIObject;
  }

  /**
   * Source: https://github.com/Mermade/oas-kit/tree/master/packages/swagger2openapi#a-command-line
   */
  interface Options {
    /** mode to handle $ref's with sibling properties */
    refSiblings?: 'remove' | 'preserve' | 'allOf';
    /** resolve internal references also */
    resolveInternal?: boolean;
    /** Property name to use for warning extensions [default: "x-s2o-warning"] */
    warnProperty?: string;
    /** output information to unresolve a definition */
    components?: boolean;
    /** enable debug mode, adds specification-extensions */
    debug?: boolean;
    /** encoding for input/output files [default: "utf8"] */
    encoding?: string;
    /** make resolution errors fatal */
    fatal?: boolean;
    /** JSON indent to use, defaults to 4 spaces */
    indent?: string;
    /** the output file to write to  */
    outfile?: string;
    /** fix up small errors in the source definition */
    patch?: boolean;
    /** resolve external references */
    resolve?: boolean;
    /** override default target version of 3.0.0 */
    targetVersion?: string;
    /** url of original spec, creates x-origin entry */
    url?: string;
    /** Do not throw on non-patchable errors, add warning extensions */
    warnOnly?: boolean;
    /** write YAML, default JSON (overridden by outfile filepath extension */
    yaml?: boolean;
    /** Extension to use to preserve body parameter names in converted operations ("" == disabled) [default: ""] */
    rbname?: string;
  }

  function convertObj(
    schema: unknown,
    options: Options,
    callback: (err: Error, data: ConverObjCallbackData) => void,
  ): void;
}
