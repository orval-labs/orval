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
} from '@orval/core';
import { getRoute } from './route';
import fs from 'fs-extra';
import { generateZod } from '@orval/zod';

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
  {
    exports: [
      {
        name: 'z',
        alias: 'zod',
        values: true,
      },
    ],
    dependency: 'zod',
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

  const paramType = params.length
    ? `param: {\n ${params
        .map((property) => property.definition)
        .join(',\n    ')},\n },`
    : '';

  const queryType = queryParams ? `query: ${queryParams?.schema.name},` : '';
  const bodyType = body.definition ? `json: ${body.definition},` : '';
  const hasIn = !!paramType || !!queryType || !!bodyType;

  return `export type ${pascal(
    operationName,
  )}Context<E extends Env = any> = Context<E, '${path}', ${
    hasIn ? `{ in: { ${paramType}${queryType}${bodyType} }}` : ''
  }>;
app.${verb.toLowerCase()}('${path}',...${operationName}Handlers)`;
};

export const generateHono: ClientBuilder = async (
  verbOptions,
  options,
  outputClient,
  output,
) => {
  const routeImplementation = generateHonoRoute(verbOptions, options);
  const zod = await generateZod(verbOptions, options, outputClient, output);

  return {
    implementation: routeImplementation
      ? `${zod.implementation}${routeImplementation}\n\n`
      : '',
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
  let value = '';

  if (verbOption.headers) {
    value += `,\n${verbOption.operationName}Header`;
  }

  if (verbOption.params.length) {
    value += `,\n${verbOption.operationName}Params`;
  }

  if (verbOption.queryParams) {
    value += `,\n${verbOption.operationName}QueryParams`;
  }

  if (verbOption.body.definition) {
    value += `,\n${verbOption.operationName}Body`;
  }

  return value;
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

export const generateExtraFiles: ClientExtraFilesBuilder = async (
  verbOptions,
  output,
) => {
  const { pathWithoutExtension, extension, dirname, filename } = getFileInfo(
    output.target,
  );

  if (output.override.hono.handlers) {
    const outputPath = upath.relativeSafe(
      output.override.hono.handlers ?? '',
      pathWithoutExtension,
    );

    return Promise.all(
      Object.values(verbOptions).map(async (verbOption) => {
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
import { ${contextTypeName}${getZvalidatorImports(
          verbOption,
        )} } from '${outputPath}';

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
    const groupByTags = Object.values(verbOptions).reduce((acc, value) => {
      const tag = value.tags[0];
      if (!acc[tag]) {
        acc[tag] = [];
      }
      acc[tag].push(value);
      return acc;
    }, {} as Record<string, GeneratorVerbOptions[]>);

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
          .map(
            (verb) =>
              `${pascal(verb.operationName)}Context${getZvalidatorImports(
                verb,
              )}`,
          )
          .join(',\n')} } from '${outputRelativePath}';

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
    .map(
      (verb) =>
        `${pascal(verb.operationName)}Context${getZvalidatorImports(verb)}`,
    )
    .join(',\n')} } from '${outputRelativePath}';

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

const honoClientBuilder: ClientGeneratorsBuilder = {
  client: generateHono,
  dependencies: getHonoDependencies,
  header: getHonoHeader,
  footer: getHonoFooter,
  extraFiles: generateExtraFiles,
};

export const builder = () => () => honoClientBuilder;

export default builder;
