import nodePath from 'node:path';

import {
  camel,
  type ClientBuilder,
  type ClientExtraFilesBuilder,
  type ClientFooterBuilder,
  type ClientGeneratorsBuilder,
  type ClientHeaderBuilder,
  type ContextSpec,
  generateMutatorImports,
  type GeneratorDependency,
  type GeneratorImport,
  type GeneratorVerbOptions,
  getFileInfo,
  getOperationTagKey,
  getOrvalGeneratedTypes,
  getParamsInPath,
  type HonoHandlerStrategy,
  isObject,
  isOperationInTagBucket,
  jsDoc,
  logWarning,
  type NormalizedMutator,
  type NormalizedOutputOptions,
  type OpenApiInfoObject,
  pascal,
  sanitize,
  getImportExtension,
  type Tsconfig,
  upath,
} from '@orval/core';
import { generateZod, getZodImportSource } from '@orval/zod';
import fs from 'fs-extra';

import {
  type DesiredImports,
  type DesiredValidator,
  ensureTypeScript,
  extractHandlerBodies,
  reconcileHandlerFile,
} from './handler-merge';
import { getRoute } from './route';

const getZodSchemaImportStatement = (
  variant: NormalizedOutputOptions['override']['zod']['variant'],
) =>
  variant === 'mini'
    ? `import * as zod from '${getZodImportSource(variant)}';`
    : `import { z as zod } from '${getZodImportSource(variant)}';`;

// Warn at most once per run when the optional `typescript` peer is missing and a
// non-`skip` strategy was requested, so the degraded behavior is never silent.
let warnedMissingTypeScript = false;

const ZVALIDATOR_SOURCE = fs
  .readFileSync(nodePath.join(import.meta.dirname, 'zValidator.ts'))
  .toString('utf8');

const HONO_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      {
        name: 'Hono',
        values: true,
      },
      {
        name: 'Context',
      },
      {
        name: 'Env',
      },
    ],
    dependency: 'hono',
  },
];

/**
 * generateModuleSpecifier generates the specifier that _from_ would use to
 * import _to_. This is syntactical and does not validate the paths.
 *
 * @param from The filesystem path to the importer.
 * @param to If a filesystem path, it and _from_ must be use the same frame of
 * reference, such as process.cwd() or both be absolute. If only one is
 * absolute, the other must be relative to process.cwd().
 *
 * Otherwise, treated as a package name and returned directly.
 *
 * @param tsconfig Optional tsconfig used to derive the runtime import
 * extension. Under `module: 'nodenext'/'node16'` the source extension (e.g.
 * `.ts`) is rewritten to its runtime equivalent (e.g. `.js`); otherwise the
 * extension is dropped to match the rest of orval.
 *
 * @return A module specifier that can be used at _from_ to import _to_.
 */
const generateModuleSpecifier = (
  from: string,
  to: string,
  tsconfig?: Tsconfig,
) => {
  if (to.startsWith('.') || nodePath.isAbsolute(to)) {
    const resolvedFrom = nodePath.resolve(from);
    const resolvedTo = nodePath.resolve(to);
    const relative = upath.getRelativeImportPath(resolvedFrom, resolvedTo);
    const sourceExt = nodePath.extname(to);
    return `${relative}${sourceExt ? getImportExtension(sourceExt, tsconfig) : ''}`;
  }

  // Not a relative or absolute file path. Import as-is.
  return to;
};

export const getHonoDependencies = () => HONO_DEPENDENCIES;

export const getHonoHeader: ClientHeaderBuilder = ({
  verbOptions,
  output,
  tag,
  clientImplementation,
}) => {
  const targetInfo = getFileInfo(output.target, {
    extension: output.fileExtension,
  });

  let handlers: string;

  const importHandlers = Object.values(verbOptions).filter((verbOption) =>
    clientImplementation.includes(`${verbOption.operationName}Handlers`),
  );

  if (output.override.hono.handlers) {
    const handlerFileInfo = getFileInfo(output.override.hono.handlers);
    handlers = importHandlers
      .map((verbOption) => {
        // Only `tags-split` puts each tag's client file inside its own
        // sub-directory. `tags` mode flattens them next to `target`, so the
        // import must be resolved from `targetInfo.dirname` directly.
        const isSplitDir = output.mode === 'tags-split';
        const tag = getOperationTagKey(verbOption);

        const handlersPath = upath.relativeSafe(
          nodePath.join(targetInfo.dirname, isSplitDir ? tag : ''),
          nodePath.join(
            handlerFileInfo.dirname,
            `./${verbOption.operationName}`,
          ),
        );

        return `import { ${verbOption.operationName}Handlers } from '${handlersPath}';`;
      })
      .join('\n');
  } else {
    const importHandlerNames = importHandlers
      .map((verbOption) => ` ${verbOption.operationName}Handlers`)
      .join(`, \n`);

    handlers = `import {\n${importHandlerNames}\n} from './${tag ?? targetInfo.filename}.handlers';`;
  }

  return `${handlers}\n\nconst app = new Hono()\n`;
};

export const getHonoFooter: ClientFooterBuilder = () =>
  ';\n\nexport default app;\n';

const generateHonoRoute = (
  { operationName, verb }: GeneratorVerbOptions,
  pathRoute: string,
) => {
  const path = getRoute(pathRoute);

  return `\n  .${verb.toLowerCase()}('${path}', ...${operationName}Handlers)`;
};

export const generateHono: ClientBuilder = (verbOptions, options) => {
  if (options.override.hono.compositeRoute) {
    return {
      implementation: '',
      imports: [],
    };
  }

  const routeImplementation = generateHonoRoute(verbOptions, options.pathRoute);

  return {
    implementation: `${routeImplementation}\n`,
    imports: [
      ...verbOptions.params.flatMap((param) => param.imports),
      ...verbOptions.body.imports,
      ...(verbOptions.queryParams
        ? [
            {
              name: verbOptions.queryParams.schema.name,
            },
          ]
        : []),
    ],
  };
};

/**
 * getHonoHandlers generates TypeScript code for the given verbs and reports
 * whether the code requires zValidator.
 */
const DEFAULT_HANDLER_BODY = '\n\n  ';

const FORM_CONTENT_TYPES = new Set([
  'multipart/form-data',
  'application/x-www-form-urlencoded',
]);

/**
 * Whether a request body uses a form encoding. Hono validates these with
 * `zValidator('form', …)` against `c.req.parseBody()`, not `'json'`.
 */
const isFormBody = (body: GeneratorVerbOptions['body']): boolean =>
  FORM_CONTENT_TYPES.has(body.contentType);

/**
 * getDesiredValidators returns the `zValidator` targets (and their PascalCase zod
 * schema identifiers) required by a verb, in canonical order. This is the single
 * source of truth shared by fresh generation and the `smart` reconcile.
 */
const getDesiredValidators = (
  verbOption: GeneratorVerbOptions,
  validator: boolean | 'hono' | NormalizedMutator,
): DesiredValidator[] => {
  if (!validator) return [];

  const pascalOperationName = pascal(verbOption.operationName);
  const validators: DesiredValidator[] = [];

  if (verbOption.headers) {
    validators.push({
      target: 'header',
      schema: `${pascalOperationName}Header`,
    });
  }
  if (verbOption.params.length > 0) {
    validators.push({
      target: 'param',
      schema: `${pascalOperationName}Params`,
    });
  }
  if (verbOption.queryParams) {
    validators.push({
      target: 'query',
      schema: `${pascalOperationName}QueryParams`,
    });
  }
  if (verbOption.body.definition) {
    validators.push({
      target: isFormBody(verbOption.body) ? 'form' : 'json',
      schema: `${pascalOperationName}Body`,
    });
  }
  if (
    validator !== 'hono' &&
    verbOption.response.originalSchema?.['200']?.content?.[
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      'application/json'
    ]
  ) {
    validators.push({
      target: 'response',
      schema: `${pascalOperationName}Response`,
    });
  }

  return validators;
};

const getHonoHandlers = (
  ...opts: {
    handlerName: string;
    contextTypeName: string;
    verbOption: GeneratorVerbOptions;
    validator: boolean | 'hono' | NormalizedMutator;
    /**
     * Optional async-handler body to splice into the generated wrapper. Used by
     * the `full` strategy to preserve user logic across regeneration.
     */
    bodyOverride?: string;
  }[]
): [
  /** The combined TypeScript handler code snippets. */
  handlerCode: string,
  /** Whether any of the handler code snippets requires importing zValidator. */
  hasZValidator: boolean,
] => {
  let code = '';
  let hasZValidator = false;

  for (const {
    handlerName,
    contextTypeName,
    verbOption,
    validator,
    bodyOverride,
  } of opts) {
    const currentValidator = getDesiredValidators(verbOption, validator)
      .map((v) => `zValidator('${v.target}', ${v.schema}),\n`)
      .join('');

    const body = bodyOverride ?? DEFAULT_HANDLER_BODY;

    code += `
export const ${handlerName} = factory.createHandlers(
${currentValidator}async (c: ${contextTypeName}) => {${body}},
);`;

    hasZValidator ||= currentValidator !== '';
  }

  return [code, hasZValidator];
};

const getZvalidatorImports = (
  verbOptions: GeneratorVerbOptions[],
  importPath: string,
  isHonoValidator: boolean,
) => {
  const specifiers = [];

  for (const {
    operationName,
    headers,
    params,
    queryParams,
    body,
    response,
  } of verbOptions) {
    const pascalOperationName = pascal(operationName);

    if (headers) {
      specifiers.push(`${pascalOperationName}Header`);
    }

    if (params.length > 0) {
      specifiers.push(`${pascalOperationName}Params`);
    }

    if (queryParams) {
      specifiers.push(`${pascalOperationName}QueryParams`);
    }

    if (body.definition) {
      specifiers.push(`${pascalOperationName}Body`);
    }

    if (
      !isHonoValidator &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      response.originalSchema?.['200']?.content?.['application/json'] !=
        undefined
    ) {
      specifiers.push(`${pascalOperationName}Response`);
    }
  }

  return specifiers.length === 0
    ? ''
    : `import {\n${specifiers.join(',\n')}\n} from '${importPath}'`;
};

const getVerbOptionGroupByTag = (
  verbOptions: Record<string, GeneratorVerbOptions>,
) => {
  const grouped: Record<string, GeneratorVerbOptions[]> = {};

  for (const value of Object.values(verbOptions)) {
    const tag = getOperationTagKey(value);
    if (!grouped[tag]) {
      grouped[tag] = [];
    }
    grouped[tag].push(value);
  }

  return grouped;
};

/** Computes the orval-owned imports a handler file should contain. */
const buildDesiredImports = ({
  verbList,
  path,
  validatorModule,
  zodModule,
  contextModule,
  validator,
  tsconfig,
}: {
  verbList: GeneratorVerbOptions[];
  path: string;
  validatorModule?: string;
  zodModule: string;
  contextModule: string;
  validator: boolean | 'hono';
  tsconfig?: Tsconfig;
}): DesiredImports => {
  const contextNames = verbList.map(
    (verb) => `${pascal(verb.operationName)}Context`,
  );
  const zodNames = verbList.flatMap((verb) =>
    getDesiredValidators(verb, validator).map((v) => v.schema),
  );
  const hasValidators = zodNames.length > 0;

  return {
    factory: { names: ['createFactory'], module: 'hono/factory' },
    validator:
      hasValidators && validatorModule != undefined
        ? {
            names: ['zValidator'],
            module: generateModuleSpecifier(path, validatorModule, tsconfig),
          }
        : undefined,
    context: {
      names: contextNames,
      module: generateModuleSpecifier(path, contextModule, tsconfig),
    },
    zod: hasValidators
      ? {
          names: zodNames,
          module: generateModuleSpecifier(path, zodModule, tsconfig),
        }
      : undefined,
  };
};

/** Generates a complete handler file from scratch (no existing file to merge). */
const generateFreshHandlerFile = ({
  verbList,
  path,
  header,
  validatorModule,
  zodModule,
  contextModule,
  validator,
  bodyFor,
  tsconfig,
}: {
  verbList: GeneratorVerbOptions[];
  path: string;
  header: string;
  validatorModule?: string;
  zodModule: string;
  contextModule: string;
  validator: boolean | 'hono';
  bodyFor?: (operationName: string) => string | undefined;
  tsconfig?: Tsconfig;
}): string => {
  const [handlerCode, hasZValidator] = getHonoHandlers(
    ...verbList.map((verbOption) => ({
      handlerName: `${verbOption.operationName}Handlers`,
      contextTypeName: `${pascal(verbOption.operationName)}Context`,
      verbOption,
      validator,
      bodyOverride: bodyFor?.(verbOption.operationName),
    })),
  );

  const imports = ["import { createFactory } from 'hono/factory';"];

  if (hasZValidator && validatorModule != undefined) {
    imports.push(
      `import { zValidator } from '${generateModuleSpecifier(path, validatorModule, tsconfig)}';`,
    );
  }

  imports.push(
    `import { ${verbList
      .map((verb) => `${pascal(verb.operationName)}Context`)
      .join(
        ',\n',
      )} } from '${generateModuleSpecifier(path, contextModule, tsconfig)}';`,
  );

  if (hasZValidator) {
    imports.push(
      getZvalidatorImports(
        verbList,
        generateModuleSpecifier(path, zodModule, tsconfig),
        validatorModule === '@hono/zod-validator',
      ),
    );
  }

  return `${header}${imports.filter((imp) => imp !== '').join('\n')}\n\nconst factory = createFactory();${handlerCode}`;
};

/**
 * Generates or updates a handler file according to `strategy`:
 *
 * - a non-existent file is always freshly generated;
 * - `skip` leaves an existing file byte-for-byte unchanged;
 * - `full` rebuilds the preamble + validator chain and splices back user bodies
 *   (drops custom imports/middleware/helpers — the thin-handler model);
 * - `smart` non-destructively reconciles orval-owned imports + validators and
 *   appends handlers for new operations, preserving all user-authored code.
 */
export const generateHandlerFile = async ({
  verbs,
  path,
  header,
  validatorModule,
  zodModule,
  contextModule,
  strategy,
  tsconfig,
}: {
  verbs: GeneratorVerbOptions[];
  path: string;
  header: string;
  validatorModule?: string;
  zodModule: string;
  contextModule: string;
  strategy: HonoHandlerStrategy;
  tsconfig?: Tsconfig;
}) => {
  const validator =
    validatorModule === '@hono/zod-validator'
      ? ('hono' as const)
      : validatorModule != undefined;

  const verbList = Object.values(verbs);

  if (!fs.existsSync(path)) {
    return generateFreshHandlerFile({
      verbList,
      path,
      header,
      validatorModule,
      zodModule,
      contextModule,
      validator,
      tsconfig,
    });
  }

  const source = await fs.readFile(path, 'utf8');

  if (strategy === 'skip') {
    return source;
  }

  // `smart` and `full` parse the existing file with the TypeScript compiler API.
  // typescript is an optional peer dependency; without it we cannot safely
  // reconcile or splice, so we preserve the existing file untouched and warn.
  if (!(await ensureTypeScript())) {
    if (!warnedMissingTypeScript) {
      warnedMissingTypeScript = true;
      logWarning(
        `hono handlerGenerationStrategy '${strategy}' requires the optional peer dependency "typescript", which is not installed. Existing handler files are left unchanged (as with 'skip'). Install typescript to enable handler reconciliation.`,
      );
    }
    return source;
  }

  if (strategy === 'full') {
    const bodies = await extractHandlerBodies(source);
    // A parse failure yields `undefined` (not an empty map): preserve the file
    // rather than regenerate with empty bodies and drop the user's logic.
    if (!bodies) {
      return source;
    }
    return generateFreshHandlerFile({
      verbList,
      path,
      header,
      validatorModule,
      zodModule,
      contextModule,
      validator,
      bodyFor: (operationName) => bodies.get(`${operationName}Handlers`),
      tsconfig,
    });
  }

  return reconcileHandlerFile(source, {
    imports: buildDesiredImports({
      verbList,
      path,
      validatorModule,
      zodModule,
      contextModule,
      validator,
      tsconfig,
    }),
    handlers: verbList.map((verbOption) => ({
      handlerName: `${verbOption.operationName}Handlers`,
      validators: getDesiredValidators(verbOption, validator),
      stub: getHonoHandlers({
        handlerName: `${verbOption.operationName}Handlers`,
        contextTypeName: `${pascal(verbOption.operationName)}Context`,
        verbOption,
        validator,
      })[0],
    })),
  });
};

const generateHandlerFiles = async (
  verbOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
  context: ContextSpec,
  validatorModule: string,
) => {
  const header = getHeader(output.override.header, getSpecInfo(context));
  const { extension, dirname, filename } = getFileInfo(output.target, {
    extension: output.fileExtension,
  });
  const strategy = output.override.hono.handlerGenerationStrategy;

  // This function _does not control_ where the .zod and .context modules land.
  // That determination is made elsewhere and this function must implement the
  // same conventions.

  if (output.override.hono.handlers) {
    // One file per operation in the user-provided directory.
    return Promise.all(
      Object.values(verbOptions).map(async (verbOption) => {
        const tag = getOperationTagKey(verbOption);

        const path = nodePath.join(
          output.override.hono.handlers ?? '',
          `./${verbOption.operationName}` + extension,
        );

        // Mirror the layout used by generateZodFiles/generateContextFiles so
        // imports resolve to the actual emitted modules.
        let zodModule: string;
        let contextModule: string;
        if (output.mode === 'tags') {
          zodModule = nodePath.join(dirname, `${tag}.zod${extension}`);
          contextModule = nodePath.join(dirname, `${tag}.context${extension}`);
        } else if (output.mode === 'tags-split') {
          zodModule = nodePath.join(dirname, tag, tag + '.zod' + extension);
          contextModule = nodePath.join(
            dirname,
            tag,
            tag + '.context' + extension,
          );
        } else {
          zodModule = nodePath.join(dirname, `${filename}.zod${extension}`);
          contextModule = nodePath.join(
            dirname,
            `${filename}.context${extension}`,
          );
        }

        return {
          content: await generateHandlerFile({
            path,
            header,
            verbs: [verbOption],
            validatorModule,
            zodModule,
            contextModule,
            strategy,
            tsconfig: output.tsconfig,
          }),
          path,
        };
      }),
    );
  }

  if (output.mode === 'tags' || output.mode === 'tags-split') {
    // One file per operation _tag_ under dirname.
    const groupByTags = getVerbOptionGroupByTag(verbOptions);

    return Promise.all(
      Object.entries(groupByTags).map(async ([tag, verbs]) => {
        const handlerPath =
          output.mode === 'tags'
            ? nodePath.join(dirname, `${tag}.handlers${extension}`)
            : nodePath.join(dirname, tag, tag + '.handlers' + extension);

        return {
          content: await generateHandlerFile({
            path: handlerPath,
            header,
            verbs,
            validatorModule,
            zodModule:
              output.mode === 'tags'
                ? nodePath.join(dirname, `${tag}.zod${extension}`)
                : nodePath.join(dirname, tag, tag + '.zod' + extension),
            contextModule:
              output.mode === 'tags'
                ? nodePath.join(dirname, `${tag}.context${extension}`)
                : nodePath.join(dirname, tag, tag + '.context' + extension),
            strategy,
            tsconfig: output.tsconfig,
          }),
          path: handlerPath,
        };
      }),
    );
  }

  // One file with all operations.
  const handlerPath = nodePath.join(
    dirname,
    `${filename}.handlers${extension}`,
  );

  return [
    {
      content: await generateHandlerFile({
        path: handlerPath,
        header,
        verbs: Object.values(verbOptions),
        validatorModule,
        zodModule: nodePath.join(dirname, `${filename}.zod${extension}`),
        contextModule: nodePath.join(
          dirname,
          `${filename}.context${extension}`,
        ),
        strategy,
        tsconfig: output.tsconfig,
      }),
      path: handlerPath,
    },
  ];
};

const getContext = (verbOption: GeneratorVerbOptions) => {
  let paramType = '';
  if (verbOption.params.length > 0) {
    const params = getParamsInPath(verbOption.pathRoute).map((name) => {
      const param = verbOption.params.find(
        (p) => p.name === sanitize(camel(name), { es5keyword: true }),
      );
      const definition = param?.definition.split(':')[1];
      const required = param?.required ?? false;
      return {
        definition: `${name}${required ? '' : '?'}:${definition}`,
      };
    });
    paramType = `param: {\n ${params
      .map((property) => property.definition)
      .join(',\n    ')},\n },`;
  }

  const queryType = verbOption.queryParams
    ? `query: ${verbOption.queryParams.schema.name},`
    : '';
  const bodyType = verbOption.body.definition
    ? `${isFormBody(verbOption.body) ? 'form' : 'json'}: ${verbOption.body.definition},`
    : '';
  const hasIn = !!paramType || !!queryType || !!bodyType;

  return `export type ${pascal(
    verbOption.operationName,
  )}Context<E extends Env = any> = Context<E, '${getRoute(
    verbOption.pathRoute,
  )}'${
    hasIn
      ? `, { in: { ${paramType}${queryType}${bodyType} }, out: { ${paramType}${queryType}${bodyType} } }`
      : ''
  }>`;
};

const getHeader = (
  option: false | ((info: OpenApiInfoObject) => string | string[]),
  info: OpenApiInfoObject,
): string => {
  if (!option) {
    return '';
  }

  const header = option(info);

  return Array.isArray(header) ? jsDoc({ description: header }) : header;
};

const getSpecInfo = (context: ContextSpec): OpenApiInfoObject =>
  context.spec.info ?? {
    title: 'API',
    version: '1.0.0',
  };

const generateContextFile = ({
  path,
  verbs,
  schemaModule,
  tsconfig,
}: {
  path: string;
  verbs: GeneratorVerbOptions[];
  schemaModule: string;
  tsconfig?: Tsconfig;
}) => {
  let content = `import type { Context, Env } from 'hono';\n\n`;

  const contexts = verbs.map((verb) => getContext(verb));

  const imps = new Set(
    verbs
      .flatMap((verb) => {
        const imports: GeneratorImport[] = [];
        if (verb.params.length > 0) {
          imports.push(...verb.params.flatMap((param) => param.imports));
        }

        if (verb.queryParams) {
          imports.push({
            name: verb.queryParams.schema.name,
          });
        }

        if (verb.body.definition) {
          imports.push(...verb.body.imports);
        }

        return imports;
      })
      .map((imp) => imp.name)
      .filter((imp) => contexts.some((context) => context.includes(imp))),
  );

  if (contexts.some((context) => context.includes('NonReadonly<'))) {
    content += getOrvalGeneratedTypes();
    content += '\n';
  }

  if (imps.size > 0) {
    content += `import type {\n${[...imps]
      .toSorted()
      .join(
        ',\n  ',
      )}\n} from '${generateModuleSpecifier(path, schemaModule, tsconfig)}';\n\n`;
  }

  content += contexts.join('\n');

  return content;
};

const generateContextFiles = (
  verbOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
  context: ContextSpec,
  schemaModule: string,
) => {
  const header = getHeader(output.override.header, getSpecInfo(context));
  const { extension, dirname, filename } = getFileInfo(output.target, {
    extension: output.fileExtension,
  });

  if (output.mode === 'tags' || output.mode === 'tags-split') {
    const groupByTags = getVerbOptionGroupByTag(verbOptions);

    return Object.entries(groupByTags).map(([tag, verbs]) => {
      const path =
        output.mode === 'tags'
          ? nodePath.join(dirname, `${tag}.context${extension}`)
          : nodePath.join(dirname, tag, tag + '.context' + extension);
      const code = generateContextFile({
        verbs,
        path,
        schemaModule: schemaModule,
        tsconfig: output.tsconfig,
      });
      return { content: `${header}${code}`, path };
    });
  }

  const path = nodePath.join(dirname, `${filename}.context${extension}`);
  const code = generateContextFile({
    verbs: Object.values(verbOptions),
    path,
    schemaModule: schemaModule,
    tsconfig: output.tsconfig,
  });

  return [
    {
      content: `${header}${code}`,
      path,
    },
  ];
};

const generateZodFiles = async (
  verbOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
  context: ContextSpec,
) => {
  const { extension, dirname, filename } = getFileInfo(output.target, {
    extension: output.fileExtension,
  });

  const header = getHeader(output.override.header, getSpecInfo(context));

  if (output.mode === 'tags' || output.mode === 'tags-split') {
    const groupByTags = getVerbOptionGroupByTag(verbOptions);

    const builderContexts = await Promise.all(
      Object.entries(groupByTags).map(async ([tag, verbs]) => {
        const zods = await Promise.all(
          verbs.map(async (verbOption) =>
            generateZod(
              verbOption,
              {
                route: verbOption.route,
                pathRoute: verbOption.pathRoute,
                override: output.override,
                context,
                output: output.target,
              },
              output.client,
            ),
          ),
        );

        if (zods.every((z) => z.implementation === '')) {
          return {
            content: '',
            path: '',
          };
        }

        const allMutators = new Map(
          zods.flatMap((z) => z.mutators ?? []).map((m) => [m.name, m]),
        )
          .values()
          .toArray();

        const mutatorsImports = generateMutatorImports({
          mutators: allMutators,
          oneMore: output.mode === 'tags-split',
        });

        let content = `${header}${getZodSchemaImportStatement(output.override.zod.variant)}\n${mutatorsImports}\n`;

        const zodPath =
          output.mode === 'tags'
            ? nodePath.join(dirname, `${tag}.zod${extension}`)
            : nodePath.join(dirname, tag, tag + '.zod' + extension);

        content += zods.map((zod) => zod.implementation).join('\n');

        return {
          content,
          path: zodPath,
        };
      }),
    );

    return builderContexts.filter((context) => context.content !== '');
  }

  const zods = await Promise.all(
    Object.values(verbOptions).map(async (verbOption) =>
      generateZod(
        verbOption,
        {
          route: verbOption.route,
          pathRoute: verbOption.pathRoute,
          override: output.override,
          context,
          output: output.target,
        },
        output.client,
      ),
    ),
  );

  const allMutators = new Map(
    zods.flatMap((z) => z.mutators ?? []).map((m) => [m.name, m]),
  )
    .values()
    .toArray();

  const mutatorsImports = generateMutatorImports({
    mutators: allMutators,
  });

  let content = `${header}${getZodSchemaImportStatement(output.override.zod.variant)}\n${mutatorsImports}\n`;

  const zodPath = nodePath.join(dirname, `${filename}.zod${extension}`);

  content += zods.map((zod) => zod.implementation).join('\n');

  return [
    {
      content,
      path: zodPath,
    },
  ];
};

const generateZvalidator = (
  output: NormalizedOutputOptions,
  context: ContextSpec,
) => {
  const header = getHeader(output.override.header, getSpecInfo(context));

  let validatorPath = output.override.hono.validatorOutputPath;
  if (!output.override.hono.validatorOutputPath) {
    const { extension, dirname, filename } = getFileInfo(output.target, {
      extension: output.fileExtension,
    });

    validatorPath = nodePath.join(dirname, `${filename}.validator${extension}`);
  }

  return {
    content: `${header}${ZVALIDATOR_SOURCE}`,
    path: validatorPath,
  };
};

const generateCompositeRoutes = (
  verbOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
  context: ContextSpec,
) => {
  const targetInfo = getFileInfo(output.target, {
    extension: output.fileExtension,
  });
  const compositeRouteInfo = getFileInfo(output.override.hono.compositeRoute);

  const header = getHeader(output.override.header, getSpecInfo(context));

  const routes = Object.values(verbOptions)
    .map((verbOption) => {
      return generateHonoRoute(verbOption, verbOption.pathRoute);
    })
    .join('');

  const importHandlers = Object.values(verbOptions);

  let ImportHandlersImplementation: string;
  if (output.override.hono.handlers) {
    const handlerFileInfo = getFileInfo(output.override.hono.handlers);
    const operationNames = importHandlers.map(
      (verbOption) => verbOption.operationName,
    );

    ImportHandlersImplementation = operationNames
      .map((operationName) => {
        const importHandlerName = `${operationName}Handlers`;

        const handlersPath = generateModuleSpecifier(
          compositeRouteInfo.path,
          nodePath.join(
            handlerFileInfo.dirname,
            `./${operationName}${targetInfo.extension}`,
          ),
          output.tsconfig,
        );

        return `import { ${importHandlerName} } from '${handlersPath}';`;
      })
      .join('\n');
  } else {
    const tags = importHandlers.map((verbOption) =>
      getOperationTagKey(verbOption),
    );
    const uniqueTags = tags.filter((t, i) => tags.indexOf(t) === i);

    ImportHandlersImplementation = uniqueTags
      .map((tag) => {
        const importHandlerNames = importHandlers
          .filter((verbOption) => isOperationInTagBucket(verbOption, tag))
          .map((verbOption) => ` ${verbOption.operationName}Handlers`)
          .join(`, \n`);

        const handlerFilePath =
          output.mode === 'tags-split'
            ? nodePath.join(
                targetInfo.dirname,
                tag,
                `${tag}.handlers${targetInfo.extension}`,
              )
            : nodePath.join(
                targetInfo.dirname,
                `${tag}.handlers${targetInfo.extension}`,
              );

        const handlersPath = generateModuleSpecifier(
          compositeRouteInfo.path,
          handlerFilePath,
          output.tsconfig,
        );

        return `import {\n${importHandlerNames}\n} from '${handlersPath}';`;
      })
      .join('\n');
  }

  const honoImport = `import { Hono } from 'hono';`;
  const honoInitialization = `\nconst app = new Hono()`;
  const honoAppExport = `\nexport default app;`;

  const content = `${header}${honoImport}
${ImportHandlersImplementation}
${honoInitialization}${routes};
${honoAppExport}
`;

  return [
    {
      content,
      path: output.override.hono.compositeRoute || '',
    },
  ];
};

export const generateExtraFiles: ClientExtraFilesBuilder = async (
  verbOptions,
  output,
  context,
) => {
  const { path, pathWithoutExtension, extension } = getFileInfo(output.target, {
    extension: output.fileExtension,
  });
  const validator = generateZvalidator(output, context);
  let schemaModule: string;

  if (output.schemas != undefined) {
    const schemasPath = (
      isObject(output.schemas) ? output.schemas.path : output.schemas
    ) as string;
    const basePath = getFileInfo(schemasPath).dirname;
    schemaModule = basePath;
  } else if (output.mode === 'single') {
    schemaModule = path;
  } else {
    schemaModule = `${pathWithoutExtension}.schemas${extension}`;
  }

  const contexts = generateContextFiles(
    verbOptions,
    output,
    context,
    schemaModule,
  );
  const compositeRoutes = output.override.hono.compositeRoute
    ? generateCompositeRoutes(verbOptions, output, context)
    : [];
  const [handlers, zods] = await Promise.all([
    generateHandlerFiles(verbOptions, output, context, validator.path),
    generateZodFiles(verbOptions, output, context),
  ]);

  return [
    ...handlers,
    ...contexts,
    ...zods,
    ...(output.override.hono.validator &&
    output.override.hono.validator !== 'hono'
      ? [validator]
      : []),
    ...compositeRoutes,
  ];
};

const honoClientBuilder: ClientGeneratorsBuilder = {
  client: generateHono,
  dependencies: getHonoDependencies,
  header: getHonoHeader,
  footer: getHonoFooter,
  extraFiles: generateExtraFiles,
};

export const builder = () => () => honoClientBuilder;

export default builder;
