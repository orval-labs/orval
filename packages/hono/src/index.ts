import {
  ClientBuilder,
  ClientExtraFilesBuilder,
  ClientFooterBuilder,
  ClientGeneratorsBuilder,
  ClientHeaderBuilder,
  GeneratorDependency,
  GeneratorOptions,
  GeneratorVerbOptions,
  getFileInfo,
  pascal,
  upath,
  kebab,
  ContextSpecs,
  NormalizedOutputOptions,
  GeneratorImport,
  getOrvalGeneratedTypes,
  jsDoc,
} from '@orval/core';
import { getRoute } from './route';
import fs from 'fs-extra';
import { generateZod } from '@orval/zod';
import { getDefaultFilesHeader } from 'orval/src/utils';
import { InfoObject } from 'openapi3-ts/oas30';

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
  {
    exports: [
      {
        name: 'zValidator',
        values: true,
      },
    ],
    dependency: '@hono/zod-validator',
  },
];

export const getHonoDependencies = () => HONO_DEPENDENCIES;

export const getHonoHeader: ClientHeaderBuilder = ({
  verbOptions,
  output,
  tag,
  clientImplementation,
}) => {
  const targetFileName = getFileInfo(output.target)?.filename;

  let handlers = '';

  if (output.override.hono?.handlers) {
    handlers = Object.keys(verbOptions)
      .filter((operationName) =>
        clientImplementation.includes(`${operationName}Handlers`),
      )
      .map((operationName) => {
        const handlersPath = upath.getSpecName(
          upath.join(output.override.hono.handlers ?? '', `./${operationName}`),
          output.target ?? '',
        );

        return `import { ${operationName}Handlers } from '.${handlersPath}';`;
      })
      .join('\n');
  } else {
    handlers = `import {\n${Object.keys(verbOptions)
      .map((operationName) => ` ${operationName}Handlers`)
      .join(`, \n`)}\n} from './${tag ?? targetFileName}.handlers';`;
  }

  return `${handlers}\n\n
const app = new Hono()\n\n`;
};

export const getHonoFooter: ClientFooterBuilder = () => 'export default app';

const generateHonoRoute = (
  { operationName, verb, queryParams, params, body }: GeneratorVerbOptions,
  { pathRoute }: GeneratorOptions,
) => {
  const path = getRoute(pathRoute);

  return `
app.${verb.toLowerCase()}('${path}',...${operationName}Handlers)`;
};

export const generateHono: ClientBuilder = async (verbOptions, options) => {
  const routeImplementation = generateHonoRoute(verbOptions, options);

  return {
    implementation: routeImplementation ? `${routeImplementation}\n\n` : '',
    imports: [
      ...verbOptions.params.map((param) => param.imports).flat(),
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

const getHonoHandlers = ({
  handlerName,
  contextTypeName,
  verbOption,
}: {
  handlerName: string;
  contextTypeName: string;
  verbOption: GeneratorVerbOptions;
}) => {
  return `
export const ${handlerName} = factory.createHandlers(
${
  verbOption.headers
    ? `zValidator('header', ${verbOption.operationName}Header),\n`
    : ''
}${
    verbOption.params.length
      ? `zValidator('param', ${verbOption.operationName}Params),\n`
      : ''
  }${
    verbOption.queryParams
      ? `zValidator('query', ${verbOption.operationName}QueryParams),\n`
      : ''
  }${
    verbOption.body.definition
      ? `zValidator('json', ${verbOption.operationName}Body),\n`
      : ''
  }(c: ${contextTypeName}) => {
  
  },
);`;
};

const getZvalidatorImports = (verbOption: GeneratorVerbOptions) => {
  let imports = [];

  if (verbOption.headers) {
    imports.push(`${verbOption.operationName}Header`);
  }

  if (verbOption.params.length) {
    imports.push(`${verbOption.operationName}Params`);
  }

  if (verbOption.queryParams) {
    imports.push(`${verbOption.operationName}QueryParams`);
  }

  if (verbOption.body.definition) {
    imports.push(`${verbOption.operationName}Body`);
  }

  return imports.join(',\n');
};

const getHandlerFix = ({
  rawFile,
  content,
  hasZValidator,
}: {
  rawFile: string;
  content: string;
  hasZValidator: boolean;
}) => {
  let newContent = content;

  if (!rawFile.includes("import { createFactory } from 'hono/factory';")) {
    newContent = `import { createFactory } from 'hono/factory';\n${newContent}`;
  }

  if (!rawFile.includes('@hono/zod-validator') && hasZValidator) {
    newContent = `import { zValidator } from '@hono/zod-validator';\n${newContent}`;
  }

  if (!rawFile.includes('const factory = createFactory();')) {
    newContent += '\nconst factory = createFactory();';
  }

  return newContent;
};

const getVerbOptionGroupByTag = (
  verbOptions: Record<string, GeneratorVerbOptions>,
) => {
  return Object.values(verbOptions).reduce(
    (acc, value) => {
      const tag = value.tags[0];
      if (!acc[tag]) {
        acc[tag] = [];
      }
      acc[tag].push(value);
      return acc;
    },
    {} as Record<string, GeneratorVerbOptions[]>,
  );
};

const generateHandlers = async (
  verbOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
) => {
  const { pathWithoutExtension, extension, dirname, filename } = getFileInfo(
    output.target,
  );

  if (output.override.hono.handlers) {
    return Promise.all(
      Object.values(verbOptions).map(async (verbOption) => {
        const isTagMode =
          output.mode === 'tags' || output.mode === 'tags-split';
        const tag = kebab(verbOption.tags[0] ?? 'default');
        const outputPath = upath.relativeSafe(
          output.override.hono.handlers ?? '',
          isTagMode ? `${dirname}/${tag}/${tag}` : pathWithoutExtension,
        );

        const handlerPath = upath.join(
          output.override.hono.handlers ?? '',
          `./${verbOption.operationName}` + extension,
        );

        const hasZValidator =
          !!verbOption.headers ||
          !!verbOption.params.length ||
          !!verbOption.queryParams ||
          !!verbOption.body;

        const isExist = fs.existsSync(handlerPath);

        const handlerName = `${verbOption.operationName}Handlers`;
        const contextTypeName = `${pascal(verbOption.operationName)}Context`;

        if (isExist) {
          const rawFile = await fs.readFile(handlerPath, 'utf8');
          let content = getHandlerFix({
            rawFile,
            content: rawFile,
            hasZValidator,
          });

          if (!rawFile.includes(handlerName)) {
            content += getHonoHandlers({
              handlerName,
              contextTypeName,
              verbOption,
            });
          }

          return {
            content,
            path: handlerPath,
          };
        }

        const content = `import { createFactory } from 'hono/factory';${
          hasZValidator
            ? `\nimport { zValidator } from '@hono/zod-validator';`
            : ''
        }
import { ${contextTypeName} } from '${outputPath}.context';
import { ${getZvalidatorImports(verbOption)} } from '${outputPath}.zod';

const factory = createFactory();

${getHonoHandlers({
  handlerName,
  contextTypeName,
  verbOption,
})}
`;

        return {
          content,
          path: handlerPath,
        };
      }),
    );
  }

  if (output.mode === 'tags' || output.mode === 'tags-split') {
    const groupByTags = getVerbOptionGroupByTag(verbOptions);

    return Promise.all(
      Object.entries(groupByTags).map(async ([tag, verbs]) => {
        const handlerPath =
          output.mode === 'tags'
            ? upath.join(dirname, `${kebab(tag)}.handlers${extension}`)
            : upath.join(dirname, tag, tag + '.handlers' + extension);

        const hasZValidator = verbs.some(
          (verb) =>
            !!verb.headers ||
            !!verb.params.length ||
            !!verb.queryParams ||
            !!verb.body,
        );

        const isExist = fs.existsSync(handlerPath);

        if (isExist) {
          const rawFile = await fs.readFile(handlerPath, 'utf8');
          let content = getHandlerFix({
            rawFile,
            content: rawFile,
            hasZValidator,
          });

          content += Object.values(verbs).reduce((acc, verbOption) => {
            const handlerName = `${verbOption.operationName}Handlers`;
            const contextTypeName = `${pascal(
              verbOption.operationName,
            )}Context`;

            if (!rawFile.includes(handlerName)) {
              acc += getHonoHandlers({
                handlerName,
                contextTypeName,
                verbOption,
              });
            }

            return acc;
          }, '');

          return {
            content,
            path: handlerPath,
          };
        }

        const outputRelativePath = `./${kebab(tag)}`;

        let content = `import { createFactory } from 'hono/factory';${
          hasZValidator
            ? `\nimport { zValidator } from '@hono/zod-validator';`
            : ''
        }
import { ${Object.values(verbs)
          .map((verb) => `${pascal(verb.operationName)}Context`)
          .join(',\n')} } from '${outputRelativePath}.context';
import { ${Object.values(verbs)
          .map((verb) => getZvalidatorImports(verb))
          .join(',\n')} } from '${outputRelativePath}.zod';

const factory = createFactory();`;

        content += Object.values(verbs).reduce((acc, verbOption) => {
          const handlerName = `${verbOption.operationName}Handlers`;
          const contextTypeName = `${pascal(verbOption.operationName)}Context`;

          acc += getHonoHandlers({
            handlerName,
            contextTypeName,
            verbOption,
          });

          return acc;
        }, '');

        return {
          content,
          path: handlerPath,
        };
      }),
    );
  }

  const hasZValidator = Object.values(verbOptions).some(
    (verb) =>
      !!verb.headers ||
      !!verb.params.length ||
      !!verb.queryParams ||
      !!verb.body,
  );

  const handlerPath = upath.join(dirname, `${filename}.handlers${extension}`);

  const isExist = fs.existsSync(handlerPath);

  if (isExist) {
    const rawFile = await fs.readFile(handlerPath, 'utf8');
    let content = getHandlerFix({
      rawFile,
      content: rawFile,
      hasZValidator,
    });

    content += Object.values(verbOptions).reduce((acc, verbOption) => {
      const handlerName = `${verbOption.operationName}Handlers`;
      const contextTypeName = `${pascal(verbOption.operationName)}Context`;

      if (!rawFile.includes(handlerName)) {
        acc += getHonoHandlers({
          handlerName,
          contextTypeName,
          verbOption,
        });
      }

      return acc;
    }, '');

    return [
      {
        content,
        path: handlerPath,
      },
    ];
  }

  const outputRelativePath = `./${filename}`;

  let content = `import { createFactory } from 'hono/factory';${
    hasZValidator ? `\nimport { zValidator } from '@hono/zod-validator';` : ''
  }
import { ${Object.values(verbOptions)
    .map((verb) => `${pascal(verb.operationName)}Context`)
    .join(',\n')} } from '${outputRelativePath}.context';
import { ${Object.values(verbOptions)
    .map((verb) => getZvalidatorImports(verb))
    .join(',\n')} } from '${outputRelativePath}.zod';

const factory = createFactory();`;

  content += Object.values(verbOptions).reduce((acc, verbOption) => {
    const handlerName = `${verbOption.operationName}Handlers`;
    const contextTypeName = `${pascal(verbOption.operationName)}Context`;

    acc += getHonoHandlers({
      handlerName,
      contextTypeName,
      verbOption,
    });

    return acc;
  }, '');

  return [
    {
      content,
      path: handlerPath,
    },
  ];
};

const getContext = (verbOption: GeneratorVerbOptions) => {
  const paramType = verbOption.params.length
    ? `param: {\n ${verbOption.params
        .map((property) => property.definition)
        .join(',\n    ')},\n },`
    : '';

  const queryType = verbOption.queryParams
    ? `query: ${verbOption.queryParams?.schema.name},`
    : '';
  const bodyType = verbOption.body.definition
    ? `json: ${verbOption.body.definition},`
    : '';
  const hasIn = !!paramType || !!queryType || !!bodyType;

  return `export type ${pascal(
    verbOption.operationName,
  )}Context<E extends Env = any> = Context<E, '${verbOption.pathRoute}', ${
    hasIn ? `{ in: { ${paramType}${queryType}${bodyType} }}` : ''
  }>`;
};

const getHeader = (
  option: false | ((info: InfoObject) => string | string[]),
  info: InfoObject,
): string => {
  if (!option) {
    return '';
  }

  const header = option(info);

  return Array.isArray(header) ? jsDoc({ description: header }) : header;
};

const generateContext = async (
  verbOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
  context: ContextSpecs,
) => {
  const header = getHeader(
    output.override.header,
    context.specs[context.specKey].info,
  );
  const { extension, dirname, filename } = getFileInfo(output.target);

  if (output.mode === 'tags' || output.mode === 'tags-split') {
    const groupByTags = getVerbOptionGroupByTag(verbOptions);

    let relativeSchemasPath = output.mode === 'tags-split' ? '../' : '';

    relativeSchemasPath += output.schemas
      ? upath.relativeSafe(dirname, getFileInfo(output.schemas).dirname)
      : `${filename}.schemas`;

    return Promise.all(
      Object.entries(groupByTags).map(async ([tag, verbs]) => {
        let content = `${header}import type { Context, Env } from 'hono';\n\n`;

        const contexts = verbs.map((verb) => getContext(verb)).join('\n');

        const imps = verbs
          .flatMap((verb) => {
            let imports: GeneratorImport[] = [];
            if (verb.params.length) {
              imports.push(...verb.params.map((param) => param.imports).flat());
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
          .filter((imp) => contexts.includes(imp.name));

        if (contexts.includes('NonReadonly<')) {
          content += getOrvalGeneratedTypes();
          content += '\n';
        }

        content += `import { ${imps
          .map((imp) => imp.name)
          .join(',\n')} } from '${relativeSchemasPath}';\n\n`;

        content += contexts;

        const contextPath =
          output.mode === 'tags'
            ? upath.join(dirname, `${kebab(tag)}.context${extension}`)
            : upath.join(dirname, tag, tag + '.context' + extension);

        return {
          content,
          path: contextPath,
        };
      }),
    );
  }

  let content = `${header}import type { Context, Env } from 'hono';\n\n`;

  const contextPath = upath.join(dirname, `${filename}.context${extension}`);

  const contexts = Object.values(verbOptions)
    .map((verbOption) => getContext(verbOption))
    .join('\n');

  const imps = Object.values(verbOptions)
    .flatMap((verb) => {
      let imports: GeneratorImport[] = [];
      if (verb.params.length) {
        imports.push(...verb.params.map((param) => param.imports).flat());
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
    .filter((imp) => contexts.includes(imp.name));

  if (contexts.includes('NonReadonly<')) {
    content += getOrvalGeneratedTypes();
    content += '\n';
  }

  const relativeSchemasPath = output.schemas
    ? upath.relativeSafe(dirname, getFileInfo(output.schemas).dirname)
    : './' + filename + '.schemas';

  content += `import { ${imps
    .map((imp) => imp.name)
    .join(',\n')} } from '${relativeSchemasPath}';\n\n`;

  content += contexts;

  return [
    {
      content,
      path: contextPath,
    },
  ];
};

const generateZodFiles = async (
  verbOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
  context: ContextSpecs,
) => {
  const { pathWithoutExtension, extension, dirname, filename } = getFileInfo(
    output.target,
  );

  const header = getHeader(
    output.override.header,
    context.specs[context.specKey].info,
  );

  if (output.mode === 'tags' || output.mode === 'tags-split') {
    const groupByTags = getVerbOptionGroupByTag(verbOptions);

    return Promise.all(
      Object.entries(groupByTags).map(async ([tag, verbs]) => {
        let content = `${header}import { z as zod } from 'zod';\n\n`;

        const zodPath =
          output.mode === 'tags'
            ? upath.join(dirname, `${kebab(tag)}.zod${extension}`)
            : upath.join(dirname, tag, tag + '.zod' + extension);

        const zods = await Promise.all(
          verbs.map((verbOption) =>
            generateZod(
              verbOption,
              {
                route: verbOption.route,
                pathRoute: verbOption.pathRoute,
                override: output.override,
                context,
                mock: output.mock,
                output: output.target!,
              },
              output.client,
            ),
          ),
        );

        content += zods.map((zod) => zod.implementation).join('\n');

        return {
          content,
          path: zodPath,
        };
      }),
    );
  }

  let content = `${header}import { z as zod } from 'zod';\n\n`;

  const zodPath = upath.join(dirname, `${filename}.zod${extension}`);

  const zods = await Promise.all(
    Object.values(verbOptions).map((verbOption) =>
      generateZod(
        verbOption,
        {
          route: verbOption.route,
          pathRoute: verbOption.pathRoute,
          override: output.override,
          context,
          mock: output.mock,
          output: output.target!,
        },
        output.client,
      ),
    ),
  );

  content += zods.map((zod) => zod.implementation).join('\n');

  return [
    {
      content,
      path: zodPath,
    },
  ];
};

export const generateExtraFiles: ClientExtraFilesBuilder = async (
  verbOptions,
  output,
  context,
) => {
  const [handlers, contexts, zods] = await Promise.all([
    generateHandlers(verbOptions, output),
    generateContext(verbOptions, output, context),
    generateZodFiles(verbOptions, output, context),
  ]);

  return [...handlers, ...contexts, ...zods];
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
