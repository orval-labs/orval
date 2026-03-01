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
  getOrvalGeneratedTypes,
  getParamsInPath,
  isObject,
  jsDoc,
  kebab,
  type NormalizedMutator,
  type NormalizedOutputOptions,
  type OpenApiInfoObject,
  pascal,
  sanitize,
  upath,
} from '@orval/core';
import { generateZod } from '@orval/zod';
import fs from 'fs-extra';

import { getRoute } from './route.ts';

const ZVALIDATOR_SOURCE = fs
  .readFileSync(upath.join(import.meta.dirname, 'zValidator.ts'))
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
 * @return A module specifier that can be used at _from_ to import _to_. It is
 * extensionless to conform with the rest of orval.
 */
const generateModuleSpecifier = (from: string, to: string) => {
  if (to.startsWith('.') || upath.isAbsolute(to)) {
    // One of "/foo/bar", "./foo/bar", "../foo/bar", etc.
    let ret: string;
    ret = upath.relativeSafe(upath.dirname(from), to);
    ret = ret.replace(/\.ts$/, '');
    ret = ret.replaceAll(upath.separator, '/');
    return ret;
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
  const targetInfo = getFileInfo(output.target);

  let handlers: string;

  const importHandlers = Object.values(verbOptions).filter((verbOption) =>
    clientImplementation.includes(`${verbOption.operationName}Handlers`),
  );

  if (output.override.hono.handlers) {
    const handlerFileInfo = getFileInfo(output.override.hono.handlers);
    handlers = importHandlers
      .map((verbOption) => {
        const isTagMode =
          output.mode === 'tags' || output.mode === 'tags-split';
        const tag = kebab(verbOption.tags[0] ?? 'default');

        const handlersPath = upath.relativeSafe(
          upath.join(targetInfo.dirname, isTagMode ? tag : ''),
          upath.join(handlerFileInfo.dirname, `./${verbOption.operationName}`),
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

  return `${handlers}\n\n
const app = new Hono()\n\n`;
};

export const getHonoFooter: ClientFooterBuilder = () => 'export default app';

const generateHonoRoute = (
  { operationName, verb }: GeneratorVerbOptions,
  pathRoute: string,
) => {
  const path = getRoute(pathRoute);

  return `
app.${verb.toLowerCase()}('${path}',...${operationName}Handlers)`;
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
    implementation: routeImplementation ? `${routeImplementation}\n\n` : '',
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
const getHonoHandlers = (
  ...opts: {
    handlerName: string;
    contextTypeName: string;
    verbOption: GeneratorVerbOptions;
    validator: boolean | 'hono' | NormalizedMutator;
  }[]
): [
  /** The combined TypeScript handler code snippets. */
  handlerCode: string,
  /** Whether any of the handler code snippets requires importing zValidator. */
  hasZValidator: boolean,
] => {
  let code = '';
  let hasZValidator = false;

  for (const { handlerName, contextTypeName, verbOption, validator } of opts) {
    let currentValidator = '';

    if (validator) {
      const pascalOperationName = pascal(verbOption.operationName);

      if (verbOption.headers) {
        currentValidator += `zValidator('header', ${pascalOperationName}Header),\n`;
      }
      if (verbOption.params.length > 0) {
        currentValidator += `zValidator('param', ${pascalOperationName}Params),\n`;
      }
      if (verbOption.queryParams) {
        currentValidator += `zValidator('query', ${pascalOperationName}QueryParams),\n`;
      }
      if (verbOption.body.definition) {
        currentValidator += `zValidator('json', ${pascalOperationName}Body),\n`;
      }
      if (
        validator !== 'hono' &&
        verbOption.response.originalSchema?.['200']?.content?.[
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          'application/json'
        ]
      ) {
        currentValidator += `zValidator('response', ${pascalOperationName}Response),\n`;
      }
    }

    code += `
export const ${handlerName} = factory.createHandlers(
${currentValidator}async (c: ${contextTypeName}) => {

  },
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
    const tag = value.tags[0];
    // this is not always false
    // TODO look into types
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!grouped[tag]) {
      grouped[tag] = [];
    }
    grouped[tag].push(value);
  }

  return grouped;
};

const generateHandlerFile = async ({
  verbs,
  path,
  validatorModule,
  zodModule,
  contextModule,
}: {
  verbs: GeneratorVerbOptions[];
  path: string;
  validatorModule?: string;
  zodModule: string;
  contextModule: string;
}) => {
  const validator =
    validatorModule === '@hono/zod-validator'
      ? ('hono' as const)
      : validatorModule != undefined;

  const isExist = fs.existsSync(path);

  if (isExist) {
    const rawFile = await fs.readFile(path, 'utf8');
    let content = rawFile;

    for (const verbOption of Object.values(verbs)) {
      const handlerName = `${verbOption.operationName}Handlers`;
      const contextTypeName = `${pascal(verbOption.operationName)}Context`;

      if (!rawFile.includes(handlerName)) {
        content += getHonoHandlers({
          handlerName,
          contextTypeName,
          verbOption,
          validator,
        })[0];
      }
    }

    return content;
  }

  const [handlerCode, hasZValidator] = getHonoHandlers(
    ...Object.values(verbs).map((verbOption) => ({
      handlerName: `${verbOption.operationName}Handlers`,
      contextTypeName: `${pascal(verbOption.operationName)}Context`,
      verbOption,
      validator,
    })),
  );

  const imports = ["import { createFactory } from 'hono/factory';"];

  if (hasZValidator && validatorModule != undefined) {
    imports.push(
      `import { zValidator } from '${generateModuleSpecifier(path, validatorModule)}';`,
    );
  }

  imports.push(
    `import { ${Object.values(verbs)
      .map((verb) => `${pascal(verb.operationName)}Context`)
      .join(',\n')} } from '${generateModuleSpecifier(path, contextModule)}';`,
  );

  if (hasZValidator) {
    imports.push(
      getZvalidatorImports(
        Object.values(verbs),
        generateModuleSpecifier(path, zodModule),
        validatorModule === '@hono/zod-validator',
      ),
    );
  }

  return `${imports.filter((imp) => imp !== '').join('\n')}

const factory = createFactory();${handlerCode}`;
};

const generateHandlerFiles = async (
  verbOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
  validatorModule: string,
) => {
  const { extension, dirname, filename } = getFileInfo(output.target);

  // This function _does not control_ where the .zod and .context modules land.
  // That determination is made elsewhere and this function must implement the
  // same conventions.

  if (output.override.hono.handlers) {
    // One file per operation in the user-provided directory.
    return Promise.all(
      Object.values(verbOptions).map(async (verbOption) => {
        const tag = kebab(verbOption.tags[0] ?? 'default');

        const path = upath.join(
          output.override.hono.handlers ?? '',
          `./${verbOption.operationName}` + extension,
        );

        return {
          content: await generateHandlerFile({
            path,
            verbs: [verbOption],
            validatorModule,
            zodModule:
              output.mode === 'tags'
                ? upath.join(dirname, `${kebab(tag)}.zod`)
                : upath.join(dirname, tag, tag + '.zod'),
            contextModule:
              output.mode === 'tags'
                ? upath.join(dirname, `${kebab(tag)}.context`)
                : upath.join(dirname, tag, tag + '.context'),
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
            ? upath.join(dirname, `${kebab(tag)}.handlers${extension}`)
            : upath.join(dirname, tag, tag + '.handlers' + extension);

        return {
          content: await generateHandlerFile({
            path: handlerPath,
            verbs,
            validatorModule,
            zodModule:
              output.mode === 'tags'
                ? upath.join(dirname, `${kebab(tag)}.zod`)
                : upath.join(dirname, tag, tag + '.zod'),
            contextModule:
              output.mode === 'tags'
                ? upath.join(dirname, `${kebab(tag)}.context`)
                : upath.join(dirname, tag, tag + '.context'),
          }),
          path: handlerPath,
        };
      }),
    );
  }

  // One file with all operations.
  const handlerPath = upath.join(dirname, `${filename}.handlers${extension}`);

  return [
    {
      content: await generateHandlerFile({
        path: handlerPath,
        verbs: Object.values(verbOptions),
        validatorModule,
        zodModule: upath.join(dirname, `${filename}.zod`),
        contextModule: upath.join(dirname, `${filename}.context`),
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
    ? `json: ${verbOption.body.definition},`
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

const generateContextFile = ({
  path,
  verbs,
  schemaModule,
}: {
  path: string;
  verbs: GeneratorVerbOptions[];
  schemaModule: string;
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
      )}\n} from '${generateModuleSpecifier(path, schemaModule)}';\n\n`;
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
  const header = getHeader(output.override.header, context.spec.info);
  const { extension, dirname, filename } = getFileInfo(output.target);

  if (output.mode === 'tags' || output.mode === 'tags-split') {
    const groupByTags = getVerbOptionGroupByTag(verbOptions);

    return Object.entries(groupByTags).map(([tag, verbs]) => {
      const path =
        output.mode === 'tags'
          ? upath.join(dirname, `${kebab(tag)}.context${extension}`)
          : upath.join(dirname, tag, tag + '.context' + extension);
      const code = generateContextFile({
        verbs,
        path,
        schemaModule: schemaModule,
      });
      return { content: `${header}${code}`, path };
    });
  }

  const path = upath.join(dirname, `${filename}.context${extension}`);
  const code = generateContextFile({
    verbs: Object.values(verbOptions),
    path,
    schemaModule: schemaModule,
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
  const { extension, dirname, filename } = getFileInfo(output.target);

  const header = getHeader(output.override.header, context.spec.info);

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
                mock: output.mock,
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
        });

        let content = `${header}import { z as zod } from 'zod';\n${mutatorsImports}\n`;

        const zodPath =
          output.mode === 'tags'
            ? upath.join(dirname, `${kebab(tag)}.zod${extension}`)
            : upath.join(dirname, tag, tag + '.zod' + extension);

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
          mock: output.mock,
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

  let content = `${header}import { z as zod } from 'zod';\n${mutatorsImports}\n`;

  const zodPath = upath.join(dirname, `${filename}.zod${extension}`);

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
  const header = getHeader(output.override.header, context.spec.info);

  let validatorPath = output.override.hono.validatorOutputPath;
  if (!output.override.hono.validatorOutputPath) {
    const { extension, dirname, filename } = getFileInfo(output.target);

    validatorPath = upath.join(dirname, `${filename}.validator${extension}`);
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
  const targetInfo = getFileInfo(output.target);
  const compositeRouteInfo = getFileInfo(output.override.hono.compositeRoute);

  const header = getHeader(output.override.header, context.spec.info);

  const routes = Object.values(verbOptions)
    .map((verbOption) => {
      return generateHonoRoute(verbOption, verbOption.pathRoute);
    })
    .join(';');

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
          upath.join(handlerFileInfo.dirname, `./${operationName}`),
        );

        return `import { ${importHandlerName} } from '${handlersPath}';`;
      })
      .join('\n');
  } else {
    const tags = importHandlers.map((verbOption) =>
      kebab(verbOption.tags[0] ?? 'default'),
    );
    const uniqueTags = tags.filter((t, i) => tags.indexOf(t) === i);

    ImportHandlersImplementation = uniqueTags
      .map((tag) => {
        const importHandlerNames = importHandlers
          .filter((verbOption) => verbOption.tags[0] === tag)
          .map((verbOption) => ` ${verbOption.operationName}Handlers`)
          .join(`, \n`);

        const handlersPath = generateModuleSpecifier(
          compositeRouteInfo.path,
          upath.join(targetInfo.dirname, tag),
        );

        return `import {\n${importHandlerNames}\n} from '${handlersPath}/${tag}.handlers';`;
      })
      .join('\n');
  }

  const honoImport = `import { Hono } from 'hono';`;
  const honoInitialization = `\nconst app = new Hono()`;
  const honoAppExport = `\nexport default app`;

  const content = `${header}${honoImport}
${ImportHandlersImplementation}
${honoInitialization}
${routes}
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
  const { path, pathWithoutExtension } = getFileInfo(output.target);
  const validator = generateZvalidator(output, context);
  let schemaModule: string;
  const isZodSchemaOutput =
    isObject(output.schemas) && output.schemas.type === 'zod';

  if (output.schemas != undefined) {
    const schemasPath = isObject(output.schemas)
      ? output.schemas.path
      : output.schemas;
    const basePath = getFileInfo(schemasPath).dirname;
    schemaModule =
      isZodSchemaOutput && output.indexFiles
        ? upath.joinSafe(basePath, 'index.zod')
        : basePath;
  } else if (output.mode === 'single') {
    schemaModule = path;
  } else {
    schemaModule = `${pathWithoutExtension}.schemas`;
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
    generateHandlerFiles(verbOptions, output, validator.path),
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
