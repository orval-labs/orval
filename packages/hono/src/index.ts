import {
  ClientBuilder,
  ClientExtraFilesBuilder,
  ClientFooterBuilder,
  ClientGeneratorsBuilder,
  ClientHeaderBuilder,
  ContextSpecs,
  generateMutatorImports,
  GeneratorDependency,
  GeneratorImport,
  GeneratorMutator,
  GeneratorVerbOptions,
  getFileInfo,
  getOrvalGeneratedTypes,
  jsDoc,
  kebab,
  NormalizedMutator,
  NormalizedOutputOptions,
  pascal,
  upath,
} from '@orval/core';
import { generateZod } from '@orval/zod';
import fs from 'fs-extra';
import { InfoObject } from 'openapi3-ts/oas30';
import { getRoute } from './route';

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

export const getHonoDependencies = () => HONO_DEPENDENCIES;

export const getHonoHeader: ClientHeaderBuilder = ({
  verbOptions,
  output,
  tag,
  clientImplementation,
}) => {
  const targetInfo = getFileInfo(output.target);

  let handlers = '';

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
          upath.join(targetInfo.dirname ?? '', isTagMode ? tag : ''),
          upath.join(
            handlerFileInfo.dirname ?? '',
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

export const generateHono: ClientBuilder = async (verbOptions, options) => {
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
  validator,
}: {
  handlerName: string;
  contextTypeName: string;
  verbOption: GeneratorVerbOptions;
  validator: boolean | 'hono' | NormalizedMutator;
}) => {
  let currentValidator = '';

  if (validator) {
    if (verbOption.headers) {
      currentValidator += `zValidator('header', ${verbOption.operationName}Header),\n`;
    }
    if (verbOption.params.length) {
      currentValidator += `zValidator('param', ${verbOption.operationName}Params),\n`;
    }
    if (verbOption.queryParams) {
      currentValidator += `zValidator('query', ${verbOption.operationName}QueryParams),\n`;
    }
    if (verbOption.body.definition) {
      currentValidator += `zValidator('json', ${verbOption.operationName}Body),\n`;
    }
    if (
      validator !== 'hono' &&
      verbOption.response.originalSchema?.['200']?.content?.['application/json']
    ) {
      currentValidator += `zValidator('response', ${verbOption.operationName}Response),\n`;
    }
  }

  return `
export const ${handlerName} = factory.createHandlers(
${currentValidator}async (c: ${contextTypeName}) => {

  },
);`;
};

const getValidatorOutputRelativePath = (
  validatorOutputPath: string,
  handlerPath: string,
) => {
  const { pathWithoutExtension } = getFileInfo(validatorOutputPath);

  return upath.relativeSafe(upath.dirname(handlerPath), pathWithoutExtension);
};

const getZvalidatorImports = (
  verbOptions: GeneratorVerbOptions[],
  importPath: string,
  isHonoValidator: boolean,
) => {
  const importImplementation = verbOptions
    .flatMap((verbOption) => {
      const imports = [];

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

      if (
        !isHonoValidator &&
        !!verbOption.response.originalSchema?.['200']?.content?.[
          'application/json'
        ]
      ) {
        imports.push(`${verbOption.operationName}Response`);
      }

      return imports.join(',\n');
    })
    .join(',\n');

  return importImplementation
    ? `import {\n${importImplementation}\n} from '${importPath}'`
    : '';
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
          !!verbOption.body.definition;

        const isExist = fs.existsSync(handlerPath);

        const handlerName = `${verbOption.operationName}Handlers`;
        const contextTypeName = `${pascal(verbOption.operationName)}Context`;

        if (isExist) {
          const rawFile = await fs.readFile(handlerPath, 'utf8');
          let content = rawFile;

          if (!rawFile.includes(handlerName)) {
            content += getHonoHandlers({
              handlerName,
              contextTypeName,
              verbOption,
              validator: output.override.hono.validator,
            });
          }

          return {
            content,
            path: handlerPath,
          };
        }

        let validatorImport = '';

        if (hasZValidator) {
          if (output.override.hono.validator === true) {
            const validatorPath = output.override.hono.validatorOutputPath
              ? getValidatorOutputRelativePath(
                  output.override.hono.validatorOutputPath,
                  handlerPath,
                )
              : `${outputPath}.validator`;

            validatorImport = `\nimport { zValidator } from '${validatorPath}';`;
          } else if (output.override.hono.validator === 'hono') {
            validatorImport = `\nimport { zValidator } from '@hono/zod-validator';`;
          }
        }

        const zodImports = output.override.hono.validator
          ? getZvalidatorImports(
              [verbOption],
              `${outputPath}.zod`,
              output.override.hono.validator === 'hono',
            )
          : '';

        const content = `import { createFactory } from 'hono/factory';${validatorImport}
import { ${contextTypeName} } from '${outputPath}.context';
${zodImports}

const factory = createFactory();

${getHonoHandlers({
  handlerName,
  contextTypeName,
  verbOption,
  validator: output.override.hono.validator,
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
            !!verb.body.definition,
        );

        const isExist = fs.existsSync(handlerPath);

        if (isExist) {
          const rawFile = await fs.readFile(handlerPath, 'utf8');
          let content = rawFile;

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
                validator: output.override.hono.validator,
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

        let validatorImport = '';
        if (hasZValidator) {
          if (output.override.hono.validator === true) {
            const validatorPath = output.override.hono.validatorOutputPath
              ? getValidatorOutputRelativePath(
                  output.override.hono.validatorOutputPath,
                  handlerPath,
                )
              : `${outputRelativePath}.validator`;

            validatorImport = `\nimport { zValidator } from '${validatorPath}';`;
          } else if (output.override.hono.validator === 'hono') {
            validatorImport = `\nimport { zValidator } from '@hono/zod-validator';`;
          }
        }

        const zodImports = output.override.hono.validator
          ? getZvalidatorImports(
              Object.values(verbs),
              `${outputRelativePath}.zod`,
              output.override.hono.validator === 'hono',
            )
          : '';

        let content = `import { createFactory } from 'hono/factory';${validatorImport}
import { ${Object.values(verbs)
          .map((verb) => `${pascal(verb.operationName)}Context`)
          .join(',\n')} } from '${outputRelativePath}.context';
${zodImports}

const factory = createFactory();`;

        content += Object.values(verbs).reduce((acc, verbOption) => {
          const handlerName = `${verbOption.operationName}Handlers`;
          const contextTypeName = `${pascal(verbOption.operationName)}Context`;

          acc += getHonoHandlers({
            handlerName,
            contextTypeName,
            verbOption,
            validator: output.override.hono.validator,
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
      !!verb.body.definition ||
      (verb.response.contentTypes.length === 1 &&
        verb.response.contentTypes[0] === 'application/json'),
  );

  const handlerPath = upath.join(dirname, `${filename}.handlers${extension}`);

  const isExist = fs.existsSync(handlerPath);

  if (isExist) {
    const rawFile = await fs.readFile(handlerPath, 'utf8');
    let content = rawFile;

    content += Object.values(verbOptions).reduce((acc, verbOption) => {
      const handlerName = `${verbOption.operationName}Handlers`;
      const contextTypeName = `${pascal(verbOption.operationName)}Context`;

      if (!rawFile.includes(handlerName)) {
        acc += getHonoHandlers({
          handlerName,
          contextTypeName,
          verbOption,
          validator: output.override.hono.validator,
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

  let validatorImport = '';

  if (hasZValidator) {
    if (output.override.hono.validator === true) {
      const validatorPath = output.override.hono.validatorOutputPath
        ? getValidatorOutputRelativePath(
            output.override.hono.validatorOutputPath,
            handlerPath,
          )
        : `${outputRelativePath}.validator`;

      validatorImport = `\nimport { zValidator } from '${validatorPath}';`;
    } else if (output.override.hono.validator === 'hono') {
      validatorImport = `\nimport { zValidator } from '@hono/zod-validator';`;
    }
  }

  const zodImports = output.override.hono.validator
    ? getZvalidatorImports(
        Object.values(verbOptions),
        `${outputRelativePath}.zod`,
        output.override.hono.validator === 'hono',
      )
    : '';

  let content = `import { createFactory } from 'hono/factory';${validatorImport}
import { ${Object.values(verbOptions)
    .map((verb) => `${pascal(verb.operationName)}Context`)
    .join(',\n')} } from '${outputRelativePath}.context';
${zodImports}

const factory = createFactory();`;

  content += Object.values(verbOptions).reduce((acc, verbOption) => {
    const handlerName = `${verbOption.operationName}Handlers`;
    const contextTypeName = `${pascal(verbOption.operationName)}Context`;

    acc += getHonoHandlers({
      handlerName,
      contextTypeName,
      verbOption,
      validator: output.override.hono.validator,
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
  )}Context<E extends Env = any> = Context<E, '${getRoute(
    verbOption.pathRoute,
  )}'${
    hasIn
      ? `, { in: { ${paramType}${queryType}${bodyType} }, out: { ${paramType}${queryType}${bodyType} } }`
      : ''
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
            const imports: GeneratorImport[] = [];
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

        if (imps.length > 0) {
          const importSchemas = imps.map((imp) => imp.name).join(',\n  ');

          content += `import {\n  ${importSchemas}\n} from '${relativeSchemasPath}';\n\n`;
        }

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
      const imports: GeneratorImport[] = [];
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
  const { extension, dirname, filename } = getFileInfo(output.target);

  const header = getHeader(
    output.override.header,
    context.specs[context.specKey].info,
  );

  if (output.mode === 'tags' || output.mode === 'tags-split') {
    const groupByTags = getVerbOptionGroupByTag(verbOptions);

    const builderContexts = await Promise.all(
      Object.entries(groupByTags).map(async ([tag, verbs]) => {
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

        if (zods.every((z) => z.implementation === '')) {
          return {
            content: '',
            path: '',
          };
        }

        const allMutators = zods.reduce(
          (acc, z) => {
            (z.mutators ?? []).forEach((mutator) => {
              acc[mutator.name] = mutator;
            });
            return acc;
          },
          {} as Record<string, GeneratorMutator>,
        );

        const mutatorsImports = generateMutatorImports({
          mutators: Object.values(allMutators),
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

    return Promise.all(
      builderContexts.filter((context) => context.content !== ''),
    );
  }

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

  const allMutators = zods.reduce(
    (acc, z) => {
      (z.mutators ?? []).forEach((mutator) => {
        acc[mutator.name] = mutator;
      });
      return acc;
    },
    {} as Record<string, GeneratorMutator>,
  );

  const mutatorsImports = generateMutatorImports({
    mutators: Object.values(allMutators),
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
  context: ContextSpecs,
) => {
  const header = getHeader(
    output.override.header,
    context.specs[context.specKey].info,
  );

  const content = `
// based on https://github.com/honojs/middleware/blob/main/packages/zod-validator/src/index.ts
import type { z, ZodSchema, ZodError } from 'zod';
import {
  Context,
  Env,
  Input,
  MiddlewareHandler,
  TypedResponse,
  ValidationTargets,
} from 'hono';

type HasUndefined<T> = undefined extends T ? true : false;

type Hook<T, E extends Env, P extends string, O = {}> = (
  result:
    | { success: true; data: T }
    | { success: false; error: ZodError; data: T },
  c: Context<E, P>,
) =>
  | Response
  | Promise<Response>
  | void
  | Promise<Response | void>
  | TypedResponse<O>;
import { zValidator as zValidatorBase } from '@hono/zod-validator';

type ValidationTargetsWithResponse = ValidationTargets & { response: any };

export const zValidator =
  <
    T extends ZodSchema,
    Target extends keyof ValidationTargetsWithResponse,
    E extends Env,
    P extends string,
    In = z.input<T>,
    Out = z.output<T>,
    I extends Input = {
      in: HasUndefined<In> extends true
        ? {
            [K in Target]?: K extends 'json'
              ? In
              : HasUndefined<
                  keyof ValidationTargetsWithResponse[K]
                > extends true
              ? { [K2 in keyof In]?: ValidationTargetsWithResponse[K][K2] }
              : { [K2 in keyof In]: ValidationTargetsWithResponse[K][K2] };
          }
        : {
            [K in Target]: K extends 'json'
              ? In
              : HasUndefined<
                  keyof ValidationTargetsWithResponse[K]
                > extends true
              ? { [K2 in keyof In]?: ValidationTargetsWithResponse[K][K2] }
              : { [K2 in keyof In]: ValidationTargetsWithResponse[K][K2] };
          };
      out: { [K in Target]: Out };
    },
    V extends I = I,
  >(
    target: Target,
    schema: T,
    hook?: Hook<z.infer<T>, E, P>,
  ): MiddlewareHandler<E, P, V> =>
  async (c, next) => {
    if (target !== 'response') {
      const value = await zValidatorBase<
        T,
        keyof ValidationTargets,
        E,
        P,
        In,
        Out,
        I,
        V
      >(
        target,
        schema,
        hook,
      )(c, next);

      if (value instanceof Response) {
        return value;
      }
    } else {
      await next();

      if (
        c.res.status !== 200 ||
       !c.res.headers.get('Content-Type')?.includes('application/json')
      ) {
        return;
      }

      let value: unknown;
      try {
        value = await c.res.json();
      } catch {
        const message = 'Malformed JSON in response';
        c.res = new Response(message, { status: 400 });

        return;
      }

      const result = await schema.safeParseAsync(value);

      if (hook) {
        const hookResult = hook({ data: value, ...result }, c);
        if (hookResult) {
          if (hookResult instanceof Response || hookResult instanceof Promise) {
            const hookResponse = await hookResult;

            if (hookResponse instanceof Response) {
              c.res = new Response(hookResponse.body, hookResponse);
            }
          }
          if (
            'response' in hookResult &&
            hookResult.response instanceof Response
          ) {
            c.res = new Response(hookResult.response.body, hookResult.response);
          }
        }
      }

      if (!result.success) {
        c.res = new Response(JSON.stringify(result), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } else {
        c.res = new Response(JSON.stringify(result.data), c.res);
      }
    }
    
    return;
  };
`;

  let validatorPath = output.override.hono.validatorOutputPath;
  if (!output.override.hono.validatorOutputPath) {
    const { extension, dirname, filename } = getFileInfo(output.target);

    validatorPath = upath.join(dirname, `${filename}.validator${extension}`);
  }

  return {
    content: `${header}${content}`,
    path: validatorPath,
  };
};

const generateCompositeRoutes = async (
  verbOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
  context: ContextSpecs,
) => {
  const targetInfo = getFileInfo(output.target);
  const compositeRouteInfo = getFileInfo(output.override.hono.compositeRoute);

  const header = getHeader(
    output.override.header,
    context.specs[context.specKey].info,
  );

  const routes = Object.values(verbOptions)
    .map((verbOption) => {
      return generateHonoRoute(verbOption, verbOption.pathRoute);
    })
    .join(';');

  const importHandlers = Object.values(verbOptions);

  let ImportHandlersImplementation = '';
  if (output.override.hono.handlers) {
    const handlerFileInfo = getFileInfo(output.override.hono.handlers);
    const operationNames = importHandlers.map(
      (verbOption) => verbOption.operationName,
    );

    ImportHandlersImplementation = operationNames
      .map((operationName) => {
        const importHandlerName = `${operationName}Handlers`;

        const handlersPath = upath.relativeSafe(
          compositeRouteInfo.dirname,
          upath.join(handlerFileInfo.dirname ?? '', `./${operationName}`),
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

        const handlersPath = upath.relativeSafe(
          compositeRouteInfo.dirname,
          upath.join(targetInfo.dirname ?? '', tag),
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
  const [handlers, contexts, zods, validator, compositeRoutes] =
    await Promise.all([
      generateHandlers(verbOptions, output),
      generateContext(verbOptions, output, context),
      generateZodFiles(verbOptions, output, context),
      generateZvalidator(output, context),
      output.override.hono.compositeRoute
        ? generateCompositeRoutes(verbOptions, output, context)
        : [],
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
