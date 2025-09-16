"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  Options: () => import_core14.Options,
  default: () => index_default,
  defineConfig: () => defineConfig,
  generate: () => generate
});
module.exports = __toCommonJS(index_exports);
var import_core13 = require("@orval/core");

// src/generate.ts
var import_core12 = require("@orval/core");

// src/import-specs.ts
var import_swagger_parser = __toESM(require("@apidevtools/swagger-parser"));
var import_core4 = require("@orval/core");
var import_chalk = __toESM(require("chalk"));
var import_fs_extra = __toESM(require("fs-extra"));
var import_js_yaml = __toESM(require("js-yaml"));

// src/import-open-api.ts
var import_core3 = require("@orval/core");

// src/api.ts
var import_core2 = require("@orval/core");
var import_mock = require("@orval/mock");

// src/client.ts
var import_angular = __toESM(require("@orval/angular"));
var import_axios = __toESM(require("@orval/axios"));
var import_core = require("@orval/core");
var import_fetch = __toESM(require("@orval/fetch"));
var import_hono = __toESM(require("@orval/hono"));
var import_mcp = __toESM(require("@orval/mcp"));
var mock = __toESM(require("@orval/mock"));
var import_query = __toESM(require("@orval/query"));
var import_swr = __toESM(require("@orval/swr"));
var import_zod = __toESM(require("@orval/zod"));
var DEFAULT_CLIENT = import_core.OutputClient.AXIOS;
var getGeneratorClient = (outputClient, output) => {
  const GENERATOR_CLIENT = {
    axios: (0, import_axios.default)({ type: "axios" })(),
    "axios-functions": (0, import_axios.default)({ type: "axios-functions" })(),
    angular: (0, import_angular.default)()(),
    "react-query": (0, import_query.default)({ output, type: "react-query" })(),
    "svelte-query": (0, import_query.default)({ output, type: "svelte-query" })(),
    "vue-query": (0, import_query.default)({ output, type: "vue-query" })(),
    swr: (0, import_swr.default)()(),
    zod: (0, import_zod.default)()(),
    hono: (0, import_hono.default)()(),
    fetch: (0, import_fetch.default)()(),
    mcp: (0, import_mcp.default)()()
  };
  const generator = (0, import_core.isFunction)(outputClient) ? outputClient(GENERATOR_CLIENT) : GENERATOR_CLIENT[outputClient];
  if (!generator) {
    throw `Oups... \u{1F37B}. Client not found: ${outputClient}`;
  }
  return generator;
};
var generateClientImports = ({
  client = DEFAULT_CLIENT,
  implementation,
  imports,
  specsName,
  hasSchemaDir,
  isAllowSyntheticDefaultImports,
  hasGlobalMutator,
  hasTagsMutator,
  hasParamsSerializerOptions,
  packageJson,
  output
}) => {
  const { dependencies } = getGeneratorClient(client, output);
  return (0, import_core.generateDependencyImports)(
    implementation,
    dependencies ? [
      ...dependencies(
        hasGlobalMutator,
        hasParamsSerializerOptions,
        packageJson,
        output.httpClient,
        hasTagsMutator,
        output.override
      ),
      ...imports
    ] : imports,
    specsName,
    hasSchemaDir,
    isAllowSyntheticDefaultImports
  );
};
var generateClientHeader = ({
  outputClient = DEFAULT_CLIENT,
  isRequestOptions,
  isGlobalMutator,
  isMutator,
  provideIn,
  hasAwaitedType,
  titles,
  output,
  verbOptions,
  tag,
  clientImplementation
}) => {
  const { header } = getGeneratorClient(outputClient, output);
  return {
    implementation: header ? header({
      title: titles.implementation,
      isRequestOptions,
      isGlobalMutator,
      isMutator,
      provideIn,
      hasAwaitedType,
      output,
      verbOptions,
      tag,
      clientImplementation
    }) : "",
    implementationMock: `export const ${titles.implementationMock} = () => [
`
  };
};
var generateClientFooter = ({
  outputClient = DEFAULT_CLIENT,
  operationNames,
  hasMutator,
  hasAwaitedType,
  titles,
  output
}) => {
  const { footer } = getGeneratorClient(outputClient, output);
  if (!footer) {
    return {
      implementation: "",
      implementationMock: `
]
`
    };
  }
  let implementation;
  try {
    if ((0, import_core.isFunction)(outputClient)) {
      implementation = footer(
        operationNames
      );
      console.warn(
        "[WARN] Passing an array of strings for operations names to the footer function is deprecated and will be removed in a future major release. Please pass them in an object instead: { operationNames: string[] }."
      );
    } else {
      implementation = footer({
        operationNames,
        title: titles.implementation,
        hasMutator,
        hasAwaitedType
      });
    }
  } catch {
    implementation = footer({
      operationNames,
      title: titles.implementation,
      hasMutator,
      hasAwaitedType
    });
  }
  return {
    implementation,
    implementationMock: `]
`
  };
};
var generateClientTitle = ({
  outputClient = DEFAULT_CLIENT,
  title,
  customTitleFunc,
  output
}) => {
  const { title: generatorTitle } = getGeneratorClient(outputClient, output);
  if (!generatorTitle) {
    return {
      implementation: "",
      implementationMock: `get${(0, import_core.pascal)(title)}Mock`
    };
  }
  if (customTitleFunc) {
    const customTitle = customTitleFunc(title);
    return {
      implementation: generatorTitle(customTitle),
      implementationMock: `get${(0, import_core.pascal)(customTitle)}Mock`
    };
  }
  return {
    implementation: generatorTitle(title),
    implementationMock: `get${(0, import_core.pascal)(title)}Mock`
  };
};
var generateMock2 = (verbOption, options) => {
  if (!options.mock) {
    return {
      implementation: {
        function: "",
        handler: "",
        handlerName: ""
      },
      imports: []
    };
  }
  if ((0, import_core.isFunction)(options.mock)) {
    return options.mock(verbOption, options);
  }
  return mock.generateMock(
    verbOption,
    options
  );
};
var generateOperations = (outputClient = DEFAULT_CLIENT, verbsOptions, options, output) => {
  return (0, import_core.asyncReduce)(
    verbsOptions,
    async (acc, verbOption) => {
      const { client: generatorClient } = getGeneratorClient(
        outputClient,
        output
      );
      const client = await generatorClient(verbOption, options, outputClient);
      if (!client.implementation) {
        return acc;
      }
      const generatedMock = generateMock2(verbOption, options);
      acc[verbOption.operationId] = {
        implementation: verbOption.doc + client.implementation,
        imports: client.imports,
        implementationMock: generatedMock.implementation,
        importsMock: generatedMock.imports,
        tags: verbOption.tags,
        mutator: verbOption.mutator,
        clientMutators: client.mutators,
        formData: verbOption.formData,
        formUrlEncoded: verbOption.formUrlEncoded,
        paramsSerializer: verbOption.paramsSerializer,
        operationName: verbOption.operationName,
        fetchReviver: verbOption.fetchReviver
      };
      return acc;
    },
    {}
  );
};
var generateExtraFiles = (outputClient = DEFAULT_CLIENT, verbsOptions, output, context) => {
  const { extraFiles: generateExtraFiles2 } = getGeneratorClient(
    outputClient,
    output
  );
  if (!generateExtraFiles2) {
    return Promise.resolve([]);
  }
  return generateExtraFiles2(verbsOptions, output, context);
};

// src/api.ts
var getApiBuilder = async ({
  input,
  output,
  context
}) => {
  const api = await (0, import_core2.asyncReduce)(
    (0, import_core2._filteredPaths)(context.specs[context.specKey].paths ?? {}, input.filters),
    async (acc, [pathRoute, verbs]) => {
      const route = (0, import_core2.getRoute)(pathRoute);
      let resolvedVerbs = verbs;
      let resolvedContext = context;
      if ((0, import_core2.isReference)(verbs)) {
        const { schema, imports } = (0, import_core2.resolveRef)(verbs, context);
        resolvedVerbs = schema;
        resolvedContext = {
          ...context,
          ...imports.length > 0 ? {
            specKey: imports[0].specKey
          } : {}
        };
      }
      let verbsOptions = await (0, import_core2.generateVerbsOptions)({
        verbs: resolvedVerbs,
        input,
        output,
        route,
        pathRoute,
        context: resolvedContext
      });
      if (output.override.useDeprecatedOperations === false) {
        verbsOptions = verbsOptions.filter((verb) => {
          return !verb.deprecated;
        });
      }
      const schemas = verbsOptions.reduce(
        (acc2, { queryParams, headers, body, response, props }) => {
          if (props) {
            acc2.push(
              ...props.flatMap(
                (param) => param.type === import_core2.GetterPropType.NAMED_PATH_PARAMS ? param.schema : []
              )
            );
          }
          if (queryParams) {
            acc2.push(queryParams.schema, ...queryParams.deps);
          }
          if (headers) {
            acc2.push(headers.schema, ...headers.deps);
          }
          acc2.push(...body.schemas, ...response.schemas);
          return acc2;
        },
        []
      );
      const fullRoute = (0, import_core2.getFullRoute)(
        route,
        verbs.servers ?? context.specs[context.specKey].servers,
        output.baseUrl
      );
      if (!output.target) {
        (0, import_core2.logError)("Output does not have a target");
        process.exit(1);
      }
      const pathOperations = await generateOperations(
        output.client,
        verbsOptions,
        {
          route: fullRoute,
          pathRoute,
          override: output.override,
          context: resolvedContext,
          mock: output.mock,
          output: output.target
        },
        output
      );
      for (const verbOption of verbsOptions) {
        acc.verbOptions[verbOption.operationId] = verbOption;
      }
      acc.schemas.push(...schemas);
      acc.operations = { ...acc.operations, ...pathOperations };
      return acc;
    },
    {
      operations: {},
      verbOptions: {},
      schemas: []
    }
  );
  const extraFiles = await generateExtraFiles(
    output.client,
    api.verbOptions,
    output,
    context
  );
  return {
    operations: api.operations,
    schemas: api.schemas,
    verbOptions: api.verbOptions,
    title: generateClientTitle,
    header: generateClientHeader,
    footer: generateClientFooter,
    imports: generateClientImports,
    importsMock: import_mock.generateMockImports,
    extraFiles
  };
};

// src/import-open-api.ts
var importOpenApi = async ({
  data,
  input,
  output,
  target,
  workspace
}) => {
  const specs = await generateInputSpecs({ specs: data, input, workspace });
  const filteredOperations = input.filters?.schemaDependencyAnalysis ? getFilteredOperations(specs[target], input.filters) : void 0;
  const schemas = getApiSchemas({
    input,
    output,
    target,
    workspace,
    specs,
    filteredOperations
  });
  const api = await getApiBuilder({
    input,
    output,
    context: {
      specKey: target,
      target,
      workspace,
      specs,
      output
    }
  });
  return {
    ...api,
    schemas: {
      ...schemas,
      [target]: [...schemas[target] ?? [], ...api.schemas]
    },
    target,
    info: specs[target].info
  };
};
var generateInputSpecs = async ({
  specs,
  input,
  workspace
}) => {
  const transformerFn = input.override?.transformer ? await (0, import_core3.dynamicImport)(input.override.transformer, workspace) : void 0;
  return (0, import_core3.asyncReduce)(
    Object.entries(specs),
    async (acc, [specKey, value]) => {
      const schema = await (0, import_core3.openApiConverter)(
        value,
        input.converterOptions,
        specKey
      );
      const transfomedSchema = transformerFn ? transformerFn(schema) : schema;
      if (input.validation) {
        await (0, import_core3.ibmOpenapiValidator)(transfomedSchema, input.validation);
      }
      acc[specKey] = transfomedSchema;
      return acc;
    },
    {}
  );
};
var getApiSchemas = ({
  input,
  output,
  target,
  workspace,
  specs,
  filteredOperations
}) => {
  return Object.entries(specs).reduce(
    (acc, [specKey, spec]) => {
      const context = {
        specKey,
        target,
        workspace,
        specs,
        output
      };
      let parsedSchemas = spec.openapi ? spec.components?.schemas : getAllSchemas(spec, specKey);
      if (input.filters?.schemaDependencyAnalysis && filteredOperations) {
        const specFilteredOperations = filteredOperations.filter(
          (op) => op.path.startsWith(specKey) || specKey === target
        );
        if (specFilteredOperations.length > 0) {
          parsedSchemas = (0, import_core3.filterSchemasByDependencies)(
            specFilteredOperations,
            parsedSchemas
          );
        }
      }
      const schemaDefinition = (0, import_core3.generateSchemasDefinition)(
        parsedSchemas,
        context,
        output.override.components.schemas.suffix,
        input.filters
      );
      const responseDefinition = (0, import_core3.generateComponentDefinition)(
        spec.components?.responses,
        context,
        output.override.components.responses.suffix
      );
      const bodyDefinition = (0, import_core3.generateComponentDefinition)(
        spec.components?.requestBodies,
        context,
        output.override.components.requestBodies.suffix
      );
      const parameters = (0, import_core3.generateParameterDefinition)(
        spec.components?.parameters,
        context,
        output.override.components.parameters.suffix
      );
      const schemas = [
        ...schemaDefinition,
        ...responseDefinition,
        ...bodyDefinition,
        ...parameters
      ];
      if (schemas.length === 0) {
        return acc;
      }
      acc[specKey] = schemas;
      return acc;
    },
    {}
  );
};
var getAllSchemas = (spec, specKey) => {
  const keysToOmit = /* @__PURE__ */ new Set([
    "openapi",
    "info",
    "servers",
    "paths",
    "components",
    "security",
    "tags",
    "externalDocs"
  ]);
  const cleanedSpec = Object.fromEntries(
    Object.entries(spec).filter(([key]) => !keysToOmit.has(key))
  );
  if (specKey && (0, import_core3.isSchema)(cleanedSpec)) {
    const name = import_core3.upath.getSchemaFileName(specKey);
    const additionalKeysToOmit = /* @__PURE__ */ new Set([
      "type",
      "properties",
      "allOf",
      "oneOf",
      "anyOf",
      "items"
    ]);
    return {
      [name]: cleanedSpec,
      ...getAllSchemas(
        Object.fromEntries(
          Object.entries(cleanedSpec).filter(
            ([key]) => !additionalKeysToOmit.has(key)
          )
        )
      )
    };
  }
  const schemas = Object.entries(cleanedSpec).reduce(
    (acc, [key, value]) => {
      if (!(0, import_core3.isObject)(value)) {
        return acc;
      }
      if (!(0, import_core3.isSchema)(value) && !(0, import_core3.isReference)(value)) {
        return { ...acc, ...getAllSchemas(value) };
      }
      acc[key] = value;
      return acc;
    },
    {}
  );
  return {
    ...schemas,
    ...spec?.components?.schemas
  };
};
var getFilteredOperations = (spec, filters) => {
  if (!filters || !spec.paths) {
    return [];
  }
  const operations = [];
  const filteredPaths = (0, import_core3._filteredPaths)(spec.paths, filters);
  filteredPaths.forEach(([pathRoute, verbs]) => {
    const filteredVerbs = (0, import_core3._filteredVerbs)(verbs, filters, pathRoute);
    filteredVerbs.forEach(([method, operation]) => {
      operations.push({
        operation,
        path: pathRoute,
        method: method.toLowerCase()
      });
    });
  });
  return operations;
};

// src/import-specs.ts
var resolveSpecs = async (path, { validate, ...options }, isUrl3, isOnlySchema) => {
  try {
    if (validate) {
      try {
        await import_swagger_parser.default.validate(path, options);
      } catch (error) {
        if (error?.name === "ParserError") {
          throw error;
        }
        if (!isOnlySchema) {
          (0, import_core4.log)(`\u26A0\uFE0F  ${import_chalk.default.yellow(error)}`);
        }
      }
    }
    const data = (await import_swagger_parser.default.resolve(path, options)).values();
    if (isUrl3) {
      return data;
    }
    return Object.fromEntries(
      Object.entries(data).sort().map(([key, value]) => [import_core4.upath.resolve(key), value])
    );
  } catch {
    const file = await import_fs_extra.default.readFile(path, "utf8");
    return {
      [path]: import_js_yaml.default.load(file)
    };
  }
};
var importSpecs = async (workspace, options) => {
  const { input, output } = options;
  if (!(0, import_core4.isString)(input.target)) {
    return importOpenApi({
      data: { [workspace]: input.target },
      input,
      output,
      target: workspace,
      workspace
    });
  }
  const isPathUrl = (0, import_core4.isUrl)(input.target);
  const data = await resolveSpecs(
    input.target,
    input.parserOptions,
    isPathUrl,
    !output.target
  );
  return importOpenApi({
    data,
    input,
    output,
    target: input.target,
    workspace
  });
};

// src/utils/options.ts
var import_core8 = require("@orval/core");
var import_mock2 = require("@orval/mock");
var import_chalk3 = __toESM(require("chalk"));

// package.json
var package_default = {
  name: "orval",
  description: "A swagger client generator for typescript",
  version: "7.11.2",
  license: "MIT",
  files: [
    "dist"
  ],
  bin: "./dist/bin/orval.js",
  type: "commonjs",
  exports: {
    ".": {
      types: "./dist/src/index.d.ts",
      default: "./dist/index.js"
    }
  },
  keywords: [
    "rest",
    "client",
    "swagger",
    "open-api",
    "fetch",
    "data fetching",
    "code-generation",
    "angular",
    "react",
    "react-query",
    "svelte",
    "svelte-query",
    "vue",
    "vue-query",
    "msw",
    "mock",
    "axios",
    "vue-query",
    "vue",
    "swr",
    "zod",
    "hono"
  ],
  author: {
    name: "Victor Bury",
    email: "victor@anymaniax.com"
  },
  repository: {
    type: "git",
    url: "git+https://github.com/TheHaff/orval.git"
  },
  scripts: {
    build: "tsup",
    prepare: "npm run build",
    dev: "tsup --watch src --onSuccess 'yarn generate-api'",
    lint: "eslint .",
    "generate-api": "orval --config ../../samples/react-query/basic/orval.config.ts",
    test: "tsc --noEmit && vitest",
    clean: "rimraf .turbo dist",
    nuke: "rimraf .turbo dist node_modules"
  },
  devDependencies: {
    "@types/fs-extra": "^11.0.4",
    "@types/js-yaml": "^4.0.9",
    "@types/lodash.uniq": "^4.5.9",
    eslint: "^9.35.0",
    "openapi-types": "^12.1.3",
    rimraf: "^6.0.1",
    tsup: "^8.5.0",
    typescript: "^5.9.2",
    vitest: "^3.2.4"
  },
  dependencies: {
    "@apidevtools/swagger-parser": "^12.0.0",
    "@orval/angular": "workspace:*",
    "@orval/axios": "workspace:*",
    "@orval/core": "workspace:*",
    "@orval/fetch": "workspace:*",
    "@orval/hono": "workspace:*",
    "@orval/mcp": "workspace:*",
    "@orval/mock": "workspace:*",
    "@orval/query": "workspace:*",
    "@orval/swr": "workspace:*",
    "@orval/zod": "workspace:*",
    cac: "^6.7.14",
    chalk: "^4.1.2",
    chokidar: "^4.0.3",
    enquirer: "^2.4.1",
    execa: "^5.1.1",
    "find-up": "5.0.0",
    "fs-extra": "^11.3.1",
    "js-yaml": "4.1.0",
    "lodash.uniq": "^4.5.0",
    "openapi3-ts": "4.5.0",
    "string-argv": "^0.3.2",
    tsconfck: "^2.1.2",
    typedoc: "^0.28.12",
    "typedoc-plugin-coverage": "^4.0.1",
    "typedoc-plugin-markdown": "^4.8.1"
  }
};

// src/utils/github.ts
var import_core5 = require("@orval/core");
var import_enquirer = require("enquirer");
var import_fs_extra2 = __toESM(require("fs-extra"));

// src/utils/request.ts
var import_node_https = __toESM(require("https"));
var request = (urlOptions, data) => {
  return new Promise((resolve, reject) => {
    const req = import_node_https.default.request(urlOptions, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk.toString());
      res.on("error", reject);
      res.on("end", () => {
        const response = {
          status: res.statusCode,
          headers: res.headers,
          body: JSON.parse(body)
        };
        if (res.statusCode && res.statusCode >= 200 && res.statusCode <= 299) {
          resolve(response);
        } else {
          reject(response);
        }
      });
    });
    req.on("error", reject);
    if (data) {
      req.write(data, "binary");
    }
    req.end();
  });
};

// src/utils/github.ts
var getGithubSpecReq = ({
  accessToken,
  repo,
  owner,
  branch,
  path
}) => {
  const payload = JSON.stringify({
    query: `query {
      repository(name: "${repo}", owner: "${owner}") {
        object(expression: "${branch}:${path}") {
          ... on Blob {
            text
          }
        }
      }
    }`
  });
  return [
    {
      method: "POST",
      hostname: "api.github.com",
      path: "/graphql",
      headers: {
        "content-type": "application/json",
        "user-agent": "orval-importer",
        authorization: `bearer ${accessToken}`,
        "Content-Length": payload.length
      }
    },
    payload
  ];
};
var githubToken = null;
var getGithubAcessToken = async (githubTokenPath) => {
  if (githubToken) {
    return githubToken;
  }
  if (await import_fs_extra2.default.pathExists(githubTokenPath)) {
    return import_fs_extra2.default.readFile(githubTokenPath, "utf8");
  } else {
    const answers = await (0, import_enquirer.prompt)([
      {
        type: "input",
        name: "githubToken",
        message: "Please provide a GitHub token with `repo` rules checked (https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/)"
      },
      {
        type: "confirm",
        name: "saveToken",
        message: "Would you like to store your token for the next time? (stored in your node_modules)"
      }
    ]);
    githubToken = answers.githubToken;
    if (answers.saveToken) {
      await import_fs_extra2.default.outputFile(githubTokenPath, answers.githubToken);
    }
    return answers.githubToken;
  }
};
var getGithubOpenApi = async (url) => {
  const githubTokenPath = import_core5.upath.join(__dirname, ".githubToken");
  const accessToken = await getGithubAcessToken(githubTokenPath);
  const [info] = url.split("github.com/").slice(-1);
  const [owner, repo, , branch, ...paths] = info.split("/");
  const path = paths.join("/");
  try {
    const { body } = await request(...getGithubSpecReq({ accessToken, repo, owner, branch, path }));
    if (body.errors?.length) {
      const isErrorRemoveLink = body.errors?.some(
        (error) => error?.type === "NOT_FOUND"
      );
      if (isErrorRemoveLink) {
        const answers = await (0, import_enquirer.prompt)([
          {
            type: "confirm",
            name: "removeToken",
            message: "Your token doesn't have the correct permissions, should we remove it?"
          }
        ]);
        if (answers.removeToken) {
          await import_fs_extra2.default.unlink(githubTokenPath);
        }
      }
    }
    return body.data?.repository?.object.text;
  } catch (error) {
    if (!error.body) {
      throw `Oups... \u{1F37B}. ${error}`;
    }
    if (error.body.message === "Bad credentials") {
      const answers = await (0, import_enquirer.prompt)([
        {
          type: "confirm",
          name: "removeToken",
          message: "Your token doesn't have the correct permissions, should we remove it?"
        }
      ]);
      if (answers.removeToken) {
        await import_fs_extra2.default.unlink(githubTokenPath);
      }
    }
    throw error.body.message || `Oups... \u{1F37B}. ${error}`;
  }
};
var githubResolver = {
  order: 199,
  canRead(file) {
    return file.url.includes("github.com");
  },
  read(file) {
    return getGithubOpenApi(file.url);
  }
};

// src/utils/package-json.ts
var import_core6 = require("@orval/core");
var import_chalk2 = __toESM(require("chalk"));
var import_find_up = __toESM(require("find-up"));
var import_fs_extra3 = __toESM(require("fs-extra"));
var import_js_yaml2 = __toESM(require("js-yaml"));
var loadPackageJson = async (packageJson, workspace = process.cwd()) => {
  if (!packageJson) {
    const pkgPath = await (0, import_find_up.default)(["package.json"], { cwd: workspace });
    if (pkgPath) {
      const pkg = await (0, import_core6.dynamicImport)(pkgPath, workspace);
      return await maybeReplaceCatalog(pkg, workspace);
    }
    return;
  }
  const normalizedPath = normalizePath(packageJson, workspace);
  if (import_fs_extra3.default.existsSync(normalizedPath)) {
    const pkg = await import(normalizedPath);
    return await maybeReplaceCatalog(pkg, workspace);
  }
  return;
};
var maybeReplaceCatalog = async (pkg, workspace) => {
  if (![
    ...Object.entries(pkg.dependencies ?? {}),
    ...Object.entries(pkg.devDependencies ?? {}),
    ...Object.entries(pkg.peerDependencies ?? {})
  ].some(([, value]) => (0, import_core6.isString)(value) && value.startsWith("catalog:"))) {
    return pkg;
  }
  const filePath = await (0, import_find_up.default)("pnpm-workspace.yaml", { cwd: workspace });
  if (!filePath) {
    (0, import_core6.log)(
      `\u26A0\uFE0F  ${import_chalk2.default.yellow("package.json contains pnpm catalog: in dependencies, but no pnpm-workspace.yaml was found.")}`
    );
    return pkg;
  }
  const file = await import_fs_extra3.default.readFile(filePath, "utf8");
  const pnpmWorkspaceFile = import_js_yaml2.default.load(file);
  performSubstitution(pkg.dependencies, pnpmWorkspaceFile);
  performSubstitution(pkg.devDependencies, pnpmWorkspaceFile);
  performSubstitution(pkg.peerDependencies, pnpmWorkspaceFile);
  return pkg;
};
var performSubstitution = (dependencies, pnpmWorkspaceFile) => {
  if (!dependencies) return;
  for (const [packageName, version] of Object.entries(dependencies)) {
    if (version === "catalog:" || version === "catalog:default") {
      if (!pnpmWorkspaceFile.catalog) {
        (0, import_core6.log)(
          `\u26A0\uFE0F  ${import_chalk2.default.yellow(`when reading from pnpm-workspace.yaml, catalog: substitution for the package '${packageName}' failed as there were no default catalog.`)}`
        );
        continue;
      }
      const sub = pnpmWorkspaceFile.catalog[packageName];
      if (!sub) {
        (0, import_core6.log)(
          `\u26A0\uFE0F  ${import_chalk2.default.yellow(`when reading from pnpm-workspace.yaml, catalog: substitution for the package '${packageName}' failed as there were no matching package in the default catalog.`)}`
        );
        continue;
      }
      dependencies[packageName] = sub;
    } else if (version.startsWith("catalog:")) {
      const catalogName = version.slice("catalog:".length);
      const catalog = pnpmWorkspaceFile.catalogs?.[catalogName];
      if (!catalog) {
        (0, import_core6.log)(
          `\u26A0\uFE0F  ${import_chalk2.default.yellow(`when reading from pnpm-workspace.yaml, '${version}' substitution for the package '${packageName}' failed as there were no matching catalog named '${catalogName}'. (available named catalogs are: ${Object.keys(pnpmWorkspaceFile.catalogs ?? {}).join(", ")})`)}`
        );
        continue;
      }
      const sub = catalog[packageName];
      if (!sub) {
        (0, import_core6.log)(
          `\u26A0\uFE0F  ${import_chalk2.default.yellow(`when reading from pnpm-workspace.yaml, '${version}' substitution for the package '${packageName}' failed as there were no package in the catalog named '${catalogName}'. (packages in the catalog are: ${Object.keys(catalog).join(", ")})`)}`
        );
        continue;
      }
      dependencies[packageName] = sub;
    }
  }
};

// src/utils/tsconfig.ts
var import_core7 = require("@orval/core");
var import_find_up2 = __toESM(require("find-up"));
var import_fs_extra4 = __toESM(require("fs-extra"));
var import_tsconfck = require("tsconfck");
var loadTsconfig = async (tsconfig, workspace = process.cwd()) => {
  if ((0, import_core7.isUndefined)(tsconfig)) {
    const configPath = await (0, import_find_up2.default)(["tsconfig.json", "jsconfig.json"], {
      cwd: workspace
    });
    if (configPath) {
      const config = await (0, import_tsconfck.parse)(configPath);
      return config.tsconfig;
    }
    return;
  }
  if ((0, import_core7.isString)(tsconfig)) {
    const normalizedPath = normalizePath(tsconfig, workspace);
    if (import_fs_extra4.default.existsSync(normalizedPath)) {
      const config = await (0, import_tsconfck.parse)(normalizedPath);
      const tsconfig2 = config.referenced?.find(
        ({ tsconfigFile }) => tsconfigFile === normalizedPath
      )?.tsconfig || config.tsconfig;
      return tsconfig2;
    }
    return;
  }
  if ((0, import_core7.isObject)(tsconfig)) {
    return tsconfig;
  }
  return;
};

// src/utils/options.ts
function defineConfig(options) {
  return options;
}
var createFormData = (workspace, formData) => {
  const defaultArrayHandling = import_core8.FormDataArrayHandling.SERIALIZE;
  if (formData === void 0)
    return { disabled: false, arrayHandling: defaultArrayHandling };
  if ((0, import_core8.isBoolean)(formData))
    return { disabled: !formData, arrayHandling: defaultArrayHandling };
  if ((0, import_core8.isString)(formData))
    return {
      disabled: false,
      mutator: normalizeMutator(workspace, formData),
      arrayHandling: defaultArrayHandling
    };
  if ("mutator" in formData || "arrayHandling" in formData)
    return {
      disabled: false,
      mutator: normalizeMutator(workspace, formData.mutator),
      arrayHandling: formData.arrayHandling ?? defaultArrayHandling
    };
  return {
    disabled: false,
    mutator: normalizeMutator(workspace, formData),
    arrayHandling: defaultArrayHandling
  };
};
var normalizeOptions = async (optionsExport, workspace = process.cwd(), globalOptions = {}) => {
  const options = await ((0, import_core8.isFunction)(optionsExport) ? optionsExport() : optionsExport);
  if (!options.input) {
    (0, import_core8.createLogger)().error(import_chalk3.default.red(`Config require an input`));
    process.exit(1);
  }
  if (!options.output) {
    (0, import_core8.createLogger)().error(import_chalk3.default.red(`Config require an output`));
    process.exit(1);
  }
  const inputOptions = (0, import_core8.isString)(options.input) ? { target: options.input } : options.input;
  const outputOptions = (0, import_core8.isString)(options.output) ? { target: options.output } : options.output;
  const outputWorkspace = normalizePath(
    outputOptions.workspace || "",
    workspace
  );
  const { clean, prettier, client, httpClient, mode, biome } = globalOptions;
  const tsconfig = await loadTsconfig(
    outputOptions.tsconfig || globalOptions.tsconfig,
    workspace
  );
  const packageJson = await loadPackageJson(
    outputOptions.packageJson || globalOptions.packageJson,
    workspace
  );
  const mockOption = outputOptions.mock ?? globalOptions.mock;
  let mock2;
  if (typeof mockOption === "boolean" && mockOption) {
    mock2 = import_mock2.DEFAULT_MOCK_OPTIONS;
  } else if ((0, import_core8.isFunction)(mockOption)) {
    mock2 = mockOption;
  } else if (mockOption) {
    mock2 = {
      ...import_mock2.DEFAULT_MOCK_OPTIONS,
      ...mockOption
    };
  } else {
    mock2 = void 0;
  }
  const defaultFileExtension = ".ts";
  const globalQueryOptions = {
    useQuery: true,
    useMutation: true,
    signal: true,
    shouldExportMutatorHooks: true,
    shouldExportHttpClient: true,
    shouldExportQueryKey: true,
    shouldSplitQueryKey: false,
    ...normalizeQueryOptions(outputOptions.override?.query, workspace)
  };
  const normalizedOptions = {
    input: {
      target: globalOptions.input ? normalizePathOrUrl(globalOptions.input, process.cwd()) : normalizePathOrUrl(inputOptions.target, workspace),
      validation: inputOptions.validation || false,
      override: {
        transformer: normalizePath(
          inputOptions.override?.transformer,
          workspace
        )
      },
      converterOptions: inputOptions.converterOptions ?? {},
      parserOptions: (0, import_core8.mergeDeep)(
        parserDefaultOptions,
        inputOptions.parserOptions ?? {}
      ),
      filters: inputOptions.filters
    },
    output: {
      target: globalOptions.output ? normalizePath(globalOptions.output, process.cwd()) : normalizePath(outputOptions.target, outputWorkspace),
      schemas: normalizePath(outputOptions.schemas, outputWorkspace),
      namingConvention: outputOptions.namingConvention || import_core8.NamingConvention.CAMEL_CASE,
      fileExtension: outputOptions.fileExtension || defaultFileExtension,
      workspace: outputOptions.workspace ? outputWorkspace : void 0,
      client: outputOptions.client ?? client ?? import_core8.OutputClient.AXIOS_FUNCTIONS,
      httpClient: outputOptions.httpClient ?? httpClient ?? import_core8.OutputHttpClient.AXIOS,
      mode: normalizeOutputMode(outputOptions.mode ?? mode),
      mock: mock2,
      clean: outputOptions.clean ?? clean ?? false,
      docs: outputOptions.docs ?? false,
      prettier: outputOptions.prettier ?? prettier ?? false,
      biome: outputOptions.biome ?? biome ?? false,
      tsconfig,
      packageJson,
      headers: outputOptions.headers ?? false,
      indexFiles: outputOptions.indexFiles ?? true,
      baseUrl: outputOptions.baseUrl,
      unionAddMissingProperties: outputOptions.unionAddMissingProperties ?? false,
      override: {
        ...outputOptions.override,
        mock: {
          arrayMin: outputOptions.override?.mock?.arrayMin ?? 1,
          arrayMax: outputOptions.override?.mock?.arrayMax ?? 10,
          stringMin: outputOptions.override?.mock?.stringMin ?? 10,
          stringMax: outputOptions.override?.mock?.stringMax ?? 20,
          fractionDigits: outputOptions.override?.mock?.fractionDigits ?? 2,
          ...outputOptions.override?.mock
        },
        operations: normalizeOperationsAndTags(
          outputOptions.override?.operations ?? {},
          outputWorkspace,
          {
            query: globalQueryOptions
          }
        ),
        tags: normalizeOperationsAndTags(
          outputOptions.override?.tags ?? {},
          outputWorkspace,
          {
            query: globalQueryOptions
          }
        ),
        mutator: normalizeMutator(
          outputWorkspace,
          outputOptions.override?.mutator
        ),
        formData: createFormData(
          outputWorkspace,
          outputOptions.override?.formData
        ),
        formUrlEncoded: ((0, import_core8.isBoolean)(outputOptions.override?.formUrlEncoded) ? outputOptions.override?.formUrlEncoded : normalizeMutator(
          outputWorkspace,
          outputOptions.override?.formUrlEncoded
        )) ?? true,
        paramsSerializer: normalizeMutator(
          outputWorkspace,
          outputOptions.override?.paramsSerializer
        ),
        header: outputOptions.override?.header === false ? false : (0, import_core8.isFunction)(outputOptions.override?.header) ? outputOptions.override?.header : getDefaultFilesHeader,
        requestOptions: outputOptions.override?.requestOptions ?? true,
        namingConvention: outputOptions.override?.namingConvention ?? {},
        components: {
          schemas: {
            suffix: import_core8.RefComponentSuffix.schemas,
            itemSuffix: outputOptions.override?.components?.schemas?.itemSuffix ?? "Item",
            ...outputOptions.override?.components?.schemas
          },
          responses: {
            suffix: import_core8.RefComponentSuffix.responses,
            ...outputOptions.override?.components?.responses
          },
          parameters: {
            suffix: import_core8.RefComponentSuffix.parameters,
            ...outputOptions.override?.components?.parameters
          },
          requestBodies: {
            suffix: import_core8.RefComponentSuffix.requestBodies,
            ...outputOptions.override?.components?.requestBodies
          }
        },
        hono: normalizeHonoOptions(outputOptions.override?.hono, workspace),
        jsDoc: normalizeJSDocOptions(outputOptions.override?.jsDoc),
        query: globalQueryOptions,
        zod: {
          strict: {
            param: outputOptions.override?.zod?.strict?.param ?? false,
            query: outputOptions.override?.zod?.strict?.query ?? false,
            header: outputOptions.override?.zod?.strict?.header ?? false,
            body: outputOptions.override?.zod?.strict?.body ?? false,
            response: outputOptions.override?.zod?.strict?.response ?? false
          },
          generate: {
            param: outputOptions.override?.zod?.generate?.param ?? true,
            query: outputOptions.override?.zod?.generate?.query ?? true,
            header: outputOptions.override?.zod?.generate?.header ?? true,
            body: outputOptions.override?.zod?.generate?.body ?? true,
            response: outputOptions.override?.zod?.generate?.response ?? true
          },
          coerce: {
            param: outputOptions.override?.zod?.coerce?.param ?? false,
            query: outputOptions.override?.zod?.coerce?.query ?? false,
            header: outputOptions.override?.zod?.coerce?.header ?? false,
            body: outputOptions.override?.zod?.coerce?.body ?? false,
            response: outputOptions.override?.zod?.coerce?.response ?? false
          },
          preprocess: {
            ...outputOptions.override?.zod?.preprocess?.param ? {
              param: normalizeMutator(
                workspace,
                outputOptions.override.zod.preprocess.param
              )
            } : {},
            ...outputOptions.override?.zod?.preprocess?.query ? {
              query: normalizeMutator(
                workspace,
                outputOptions.override.zod.preprocess.query
              )
            } : {},
            ...outputOptions.override?.zod?.preprocess?.header ? {
              header: normalizeMutator(
                workspace,
                outputOptions.override.zod.preprocess.header
              )
            } : {},
            ...outputOptions.override?.zod?.preprocess?.body ? {
              body: normalizeMutator(
                workspace,
                outputOptions.override.zod.preprocess.body
              )
            } : {},
            ...outputOptions.override?.zod?.preprocess?.response ? {
              response: normalizeMutator(
                workspace,
                outputOptions.override.zod.preprocess.response
              )
            } : {}
          },
          generateEachHttpStatus: outputOptions.override?.zod?.generateEachHttpStatus ?? false,
          dateTimeOptions: outputOptions.override?.zod?.dateTimeOptions ?? {},
          timeOptions: outputOptions.override?.zod?.timeOptions ?? {}
        },
        swr: {
          ...outputOptions.override?.swr
        },
        angular: {
          provideIn: outputOptions.override?.angular?.provideIn ?? "root"
        },
        fetch: {
          includeHttpResponseReturnType: outputOptions.override?.fetch?.includeHttpResponseReturnType ?? true,
          explode: outputOptions.override?.fetch?.explode ?? true,
          ...outputOptions.override?.fetch
        },
        useDates: outputOptions.override?.useDates || false,
        useDeprecatedOperations: outputOptions.override?.useDeprecatedOperations ?? true,
        enumGenerationType: outputOptions.override?.useNativeEnums ?? false ? "enum" : outputOptions.override?.enumGenerationType ?? "const",
        suppressReadonlyModifier: outputOptions.override?.suppressReadonlyModifier || false
      },
      allParamsOptional: outputOptions.allParamsOptional ?? false,
      urlEncodeParameters: outputOptions.urlEncodeParameters ?? false,
      optionsParamRequired: outputOptions.optionsParamRequired ?? false,
      propertySortOrder: outputOptions.propertySortOrder ?? import_core8.PropertySortOrder.SPECIFICATION
    },
    hooks: options.hooks ? normalizeHooks(options.hooks) : {}
  };
  if (!normalizedOptions.input.target) {
    (0, import_core8.createLogger)().error(import_chalk3.default.red(`Config require an input target`));
    process.exit(1);
  }
  if (!normalizedOptions.output.target && !normalizedOptions.output.schemas) {
    (0, import_core8.createLogger)().error(
      import_chalk3.default.red(`Config require an output target or schemas`)
    );
    process.exit(1);
  }
  return normalizedOptions;
};
var parserDefaultOptions = {
  validate: true,
  resolve: { github: githubResolver }
};
var normalizeMutator = (workspace, mutator) => {
  if ((0, import_core8.isObject)(mutator)) {
    if (!mutator.path) {
      (0, import_core8.createLogger)().error(import_chalk3.default.red(`Mutator need a path`));
      process.exit(1);
    }
    return {
      ...mutator,
      path: import_core8.upath.resolve(workspace, mutator.path),
      default: (mutator.default || !mutator.name) ?? false
    };
  }
  if ((0, import_core8.isString)(mutator)) {
    return {
      path: import_core8.upath.resolve(workspace, mutator),
      default: true
    };
  }
  return mutator;
};
var normalizePathOrUrl = (path, workspace) => {
  if ((0, import_core8.isString)(path) && !(0, import_core8.isUrl)(path)) {
    return normalizePath(path, workspace);
  }
  return path;
};
var normalizePath = (path, workspace) => {
  if (!(0, import_core8.isString)(path)) {
    return path;
  }
  return import_core8.upath.resolve(workspace, path);
};
var normalizeOperationsAndTags = (operationsOrTags, workspace, global) => {
  return Object.fromEntries(
    Object.entries(operationsOrTags).map(
      ([
        key,
        {
          transformer,
          mutator,
          formData,
          formUrlEncoded,
          paramsSerializer,
          query: query2,
          zod: zod2,
          ...rest
        }
      ]) => {
        return [
          key,
          {
            ...rest,
            ...query2 ? {
              query: normalizeQueryOptions(query2, workspace, global.query)
            } : {},
            ...zod2 ? {
              zod: {
                strict: {
                  param: zod2.strict?.param ?? false,
                  query: zod2.strict?.query ?? false,
                  header: zod2.strict?.header ?? false,
                  body: zod2.strict?.body ?? false,
                  response: zod2.strict?.response ?? false
                },
                generate: {
                  param: zod2.generate?.param ?? true,
                  query: zod2.generate?.query ?? true,
                  header: zod2.generate?.header ?? true,
                  body: zod2.generate?.body ?? true,
                  response: zod2.generate?.response ?? true
                },
                coerce: {
                  param: zod2.coerce?.param ?? false,
                  query: zod2.coerce?.query ?? false,
                  header: zod2.coerce?.header ?? false,
                  body: zod2.coerce?.body ?? false,
                  response: zod2.coerce?.response ?? false
                },
                preprocess: {
                  ...zod2.preprocess?.param ? {
                    param: normalizeMutator(
                      workspace,
                      zod2.preprocess.param
                    )
                  } : {},
                  ...zod2.preprocess?.query ? {
                    query: normalizeMutator(
                      workspace,
                      zod2.preprocess.query
                    )
                  } : {},
                  ...zod2.preprocess?.header ? {
                    header: normalizeMutator(
                      workspace,
                      zod2.preprocess.header
                    )
                  } : {},
                  ...zod2.preprocess?.body ? {
                    body: normalizeMutator(
                      workspace,
                      zod2.preprocess.body
                    )
                  } : {},
                  ...zod2.preprocess?.response ? {
                    response: normalizeMutator(
                      workspace,
                      zod2.preprocess.response
                    )
                  } : {}
                },
                generateEachHttpStatus: zod2?.generateEachHttpStatus ?? false,
                dateTimeOptions: zod2?.dateTimeOptions ?? {},
                timeOptions: zod2?.timeOptions ?? {}
              }
            } : {},
            ...transformer ? { transformer: normalizePath(transformer, workspace) } : {},
            ...mutator ? { mutator: normalizeMutator(workspace, mutator) } : {},
            ...createFormData(workspace, formData),
            ...formUrlEncoded ? {
              formUrlEncoded: (0, import_core8.isBoolean)(formUrlEncoded) ? formUrlEncoded : normalizeMutator(workspace, formUrlEncoded)
            } : {},
            ...paramsSerializer ? {
              paramsSerializer: normalizeMutator(
                workspace,
                paramsSerializer
              )
            } : {}
          }
        ];
      }
    )
  );
};
var normalizeOutputMode = (mode) => {
  if (!mode) {
    return import_core8.OutputMode.SINGLE;
  }
  if (!Object.values(import_core8.OutputMode).includes(mode)) {
    (0, import_core8.createLogger)().warn(import_chalk3.default.yellow(`Unknown the provided mode => ${mode}`));
    return import_core8.OutputMode.SINGLE;
  }
  return mode;
};
var normalizeHooks = (hooks) => {
  const keys = Object.keys(hooks);
  return keys.reduce((acc, key) => {
    if ((0, import_core8.isString)(hooks[key])) {
      return {
        ...acc,
        [key]: [hooks[key]]
      };
    } else if (Array.isArray(hooks[key])) {
      return {
        ...acc,
        [key]: hooks[key]
      };
    } else if ((0, import_core8.isFunction)(hooks[key])) {
      return {
        ...acc,
        [key]: [hooks[key]]
      };
    } else if ((0, import_core8.isObject)(hooks[key])) {
      return {
        ...acc,
        [key]: [hooks[key]]
      };
    }
    return acc;
  }, {});
};
var normalizeHonoOptions = (hono2 = {}, workspace) => {
  return {
    ...hono2.handlers ? { handlers: import_core8.upath.resolve(workspace, hono2.handlers) } : {},
    compositeRoute: hono2.compositeRoute ?? "",
    validator: hono2.validator ?? true,
    validatorOutputPath: hono2.validatorOutputPath ? import_core8.upath.resolve(workspace, hono2.validatorOutputPath) : ""
  };
};
var normalizeJSDocOptions = (jsdoc = {}) => {
  return {
    ...jsdoc
  };
};
var normalizeQueryOptions = (queryOptions = {}, outputWorkspace, globalOptions = {}) => {
  if (queryOptions.options) {
    console.warn(
      "[WARN] Using query options is deprecated and will be removed in a future major release. Please use queryOptions or mutationOptions instead."
    );
  }
  return {
    ...(0, import_core8.isUndefined)(queryOptions.usePrefetch) ? {} : { usePrefetch: queryOptions.usePrefetch },
    ...(0, import_core8.isUndefined)(queryOptions.useQuery) ? {} : { useQuery: queryOptions.useQuery },
    ...(0, import_core8.isUndefined)(queryOptions.useSuspenseQuery) ? {} : { useSuspenseQuery: queryOptions.useSuspenseQuery },
    ...(0, import_core8.isUndefined)(queryOptions.useMutation) ? {} : { useMutation: queryOptions.useMutation },
    ...(0, import_core8.isUndefined)(queryOptions.useInfinite) ? {} : { useInfinite: queryOptions.useInfinite },
    ...(0, import_core8.isUndefined)(queryOptions.useSuspenseInfiniteQuery) ? {} : { useSuspenseInfiniteQuery: queryOptions.useSuspenseInfiniteQuery },
    ...queryOptions.useInfiniteQueryParam ? { useInfiniteQueryParam: queryOptions.useInfiniteQueryParam } : {},
    ...queryOptions.options ? { options: queryOptions.options } : {},
    ...globalOptions.queryKey ? {
      queryKey: globalOptions.queryKey
    } : {},
    ...queryOptions?.queryKey ? {
      queryKey: normalizeMutator(outputWorkspace, queryOptions?.queryKey)
    } : {},
    ...globalOptions.queryOptions ? {
      queryOptions: globalOptions.queryOptions
    } : {},
    ...queryOptions?.queryOptions ? {
      queryOptions: normalizeMutator(
        outputWorkspace,
        queryOptions?.queryOptions
      )
    } : {},
    ...globalOptions.mutationOptions ? {
      mutationOptions: globalOptions.mutationOptions
    } : {},
    ...queryOptions?.mutationOptions ? {
      mutationOptions: normalizeMutator(
        outputWorkspace,
        queryOptions?.mutationOptions
      )
    } : {},
    ...(0, import_core8.isUndefined)(globalOptions.shouldExportQueryKey) ? {} : {
      shouldExportQueryKey: globalOptions.shouldExportQueryKey
    },
    ...(0, import_core8.isUndefined)(queryOptions.shouldExportQueryKey) ? {} : { shouldExportQueryKey: queryOptions.shouldExportQueryKey },
    ...(0, import_core8.isUndefined)(globalOptions.shouldExportHttpClient) ? {} : {
      shouldExportHttpClient: globalOptions.shouldExportHttpClient
    },
    ...(0, import_core8.isUndefined)(queryOptions.shouldExportHttpClient) ? {} : { shouldExportHttpClient: queryOptions.shouldExportHttpClient },
    ...(0, import_core8.isUndefined)(globalOptions.shouldExportMutatorHooks) ? {} : {
      shouldExportMutatorHooks: globalOptions.shouldExportMutatorHooks
    },
    ...(0, import_core8.isUndefined)(queryOptions.shouldExportMutatorHooks) ? {} : { shouldExportMutatorHooks: queryOptions.shouldExportMutatorHooks },
    ...(0, import_core8.isUndefined)(globalOptions.shouldSplitQueryKey) ? {} : {
      shouldSplitQueryKey: globalOptions.shouldSplitQueryKey
    },
    ...(0, import_core8.isUndefined)(queryOptions.shouldSplitQueryKey) ? {} : { shouldSplitQueryKey: queryOptions.shouldSplitQueryKey },
    ...(0, import_core8.isUndefined)(globalOptions.signal) ? {} : {
      signal: globalOptions.signal
    },
    ...(0, import_core8.isUndefined)(queryOptions.signal) ? {} : { signal: queryOptions.signal },
    ...(0, import_core8.isUndefined)(globalOptions.version) ? {} : {
      version: globalOptions.version
    },
    ...(0, import_core8.isUndefined)(queryOptions.version) ? {} : { version: queryOptions.version }
  };
};
var getDefaultFilesHeader = ({
  title,
  description,
  version
} = {}) => [
  `Generated by ${package_default.name} v${package_default.version} \u{1F37A}`,
  `Do not edit manually.`,
  ...title ? [title] : [],
  ...description ? [description] : [],
  ...version ? [`OpenAPI spec version: ${version}`] : []
];

// src/utils/watcher.ts
var import_core9 = require("@orval/core");
var startWatcher = async (watchOptions, watchFn, defaultTarget = ".") => {
  if (!watchOptions) return;
  const { watch } = await import("chokidar");
  const ignored = ["**/{.git,node_modules}/**"];
  const watchPaths = typeof watchOptions === "boolean" ? defaultTarget : Array.isArray(watchOptions) ? watchOptions.filter(
    (path) => typeof path === "string"
  ) : watchOptions;
  (0, import_core9.log)(
    `Watching for changes in ${Array.isArray(watchPaths) ? watchPaths.map((v) => '"' + v + '"').join(" | ") : '"' + watchPaths + '"'}`
  );
  const watcher = watch(watchPaths, {
    ignorePermissionErrors: true,
    ignored
  });
  watcher.on("all", async (type, file) => {
    (0, import_core9.log)(`Change detected: ${type} ${file}`);
    try {
      await watchFn();
    } catch (error) {
      (0, import_core9.logError)(error);
    }
  });
};

// src/write-specs.ts
var import_core11 = require("@orval/core");
var import_chalk5 = __toESM(require("chalk"));
var import_execa2 = __toESM(require("execa"));
var import_fs_extra5 = __toESM(require("fs-extra"));
var import_lodash = __toESM(require("lodash.uniq"));

// src/utils/executeHook.ts
var import_core10 = require("@orval/core");
var import_chalk4 = __toESM(require("chalk"));
var import_execa = __toESM(require("execa"));
var import_string_argv = require("string-argv");
var executeHook = async (name, commands = [], args = []) => {
  (0, import_core10.log)(import_chalk4.default.white(`Running ${name} hook...`));
  for (const command of commands) {
    try {
      if ((0, import_core10.isString)(command)) {
        await executeCommand(command, args);
      } else if ((0, import_core10.isFunction)(command)) {
        await command(args);
      } else if ((0, import_core10.isObject)(command)) {
        await executeObjectCommand(command, args);
      }
    } catch (error) {
      (0, import_core10.logError)(error, `Failed to run ${name} hook`);
    }
  }
};
async function executeCommand(command, args) {
  const [cmd, ..._args] = [...(0, import_string_argv.parseArgsStringToArgv)(command), ...args];
  await (0, import_execa.default)(cmd, _args);
}
async function executeObjectCommand(command, args) {
  if (command.injectGeneratedDirsAndFiles === false) {
    args = [];
  }
  if ((0, import_core10.isString)(command.command)) {
    await executeCommand(command.command, args);
  } else if ((0, import_core10.isFunction)(command.command)) {
    await command.command();
  }
}

// src/write-specs.ts
var getHeader = (option, info) => {
  if (!option) {
    return "";
  }
  const header = option(info);
  return Array.isArray(header) ? (0, import_core11.jsDoc)({ description: header }) : header;
};
var writeSpecs = async (builder, workspace, options, projectName) => {
  const { info = { title: "", version: 0 }, schemas, target } = builder;
  const { output } = options;
  const projectTitle = projectName || info.title;
  const specsName = Object.keys(schemas).reduce((acc, specKey) => {
    const basePath = import_core11.upath.getSpecName(specKey, target);
    const name = basePath.slice(1).split("/").join("-");
    acc[specKey] = name;
    return acc;
  }, {});
  const header = getHeader(output.override.header, info);
  if (output.schemas) {
    const rootSchemaPath = output.schemas;
    const fileExtension = ["tags", "tags-split", "split"].includes(output.mode) ? ".ts" : output.fileExtension ?? ".ts";
    await Promise.all(
      Object.entries(schemas).map(([specKey, schemas2]) => {
        const schemaPath = (0, import_core11.isRootKey)(specKey, target) ? rootSchemaPath : import_core11.upath.join(rootSchemaPath, specsName[specKey]);
        return (0, import_core11.writeSchemas)({
          schemaPath,
          schemas: schemas2,
          target,
          namingConvention: output.namingConvention,
          fileExtension,
          specsName,
          specKey,
          isRootKey: (0, import_core11.isRootKey)(specKey, target),
          header,
          indexFiles: output.indexFiles
        });
      })
    );
  }
  let implementationPaths = [];
  if (output.target) {
    const writeMode = getWriteMode(output.mode);
    implementationPaths = await writeMode({
      builder,
      workspace,
      output,
      specsName,
      header,
      needSchema: !output.schemas && output.client !== "zod"
    });
  }
  if (output.workspace) {
    const workspacePath = output.workspace;
    const imports = implementationPaths.filter(
      (path) => !output.mock || !path.endsWith(`.${(0, import_core11.getMockFileExtensionByTypeName)(output.mock)}.ts`)
    ).map(
      (path) => import_core11.upath.relativeSafe(
        workspacePath,
        (0, import_core11.getFileInfo)(path).pathWithoutExtension
      )
    );
    if (output.schemas) {
      imports.push(
        import_core11.upath.relativeSafe(workspacePath, (0, import_core11.getFileInfo)(output.schemas).dirname)
      );
    }
    if (output.indexFiles) {
      const indexFile = import_core11.upath.join(workspacePath, "/index.ts");
      if (await import_fs_extra5.default.pathExists(indexFile)) {
        const data = await import_fs_extra5.default.readFile(indexFile, "utf8");
        const importsNotDeclared = imports.filter((imp) => !data.includes(imp));
        await import_fs_extra5.default.appendFile(
          indexFile,
          (0, import_lodash.default)(importsNotDeclared).map((imp) => `export * from '${imp}';
`).join("")
        );
      } else {
        await import_fs_extra5.default.outputFile(
          indexFile,
          (0, import_lodash.default)(imports).map((imp) => `export * from '${imp}';`).join("\n") + "\n"
        );
      }
      implementationPaths = [indexFile, ...implementationPaths];
    }
  }
  if (builder.extraFiles.length > 0) {
    await Promise.all(
      builder.extraFiles.map(
        async (file) => import_fs_extra5.default.outputFile(file.path, file.content)
      )
    );
    implementationPaths = [
      ...implementationPaths,
      ...builder.extraFiles.map((file) => file.path)
    ];
  }
  const paths = [
    ...output.schemas ? [(0, import_core11.getFileInfo)(output.schemas).dirname] : [],
    ...implementationPaths
  ];
  if (options.hooks.afterAllFilesWrite) {
    await executeHook(
      "afterAllFilesWrite",
      options.hooks.afterAllFilesWrite,
      paths
    );
  }
  if (output.prettier) {
    try {
      await (0, import_execa2.default)("prettier", ["--write", ...paths]);
    } catch {
      (0, import_core11.log)(
        import_chalk5.default.yellow(
          `\u26A0\uFE0F  ${projectTitle ? `${projectTitle} - ` : ""}Globally installed prettier not found`
        )
      );
    }
  }
  if (output.biome) {
    try {
      await (0, import_execa2.default)("biome", ["check", "--write", ...paths]);
    } catch (error) {
      const message = error.exitCode === 1 ? error.stdout + error.stderr : `\u26A0\uFE0F  ${projectTitle ? `${projectTitle} - ` : ""}biome not found`;
      (0, import_core11.log)(import_chalk5.default.yellow(message));
    }
  }
  if (output.docs) {
    try {
      let config = {};
      let configPath = null;
      if (typeof output.docs === "object") {
        ({ configPath = null, ...config } = output.docs);
        if (configPath) {
          config.options = configPath;
        }
      }
      const getTypedocApplication = async () => {
        const { Application: Application2 } = await import("typedoc");
        return Application2;
      };
      const Application = await getTypedocApplication();
      const app = await Application.bootstrapWithPlugins({
        entryPoints: paths,
        theme: "markdown",
        // Set the custom config location if it has been provided.
        ...config,
        plugin: ["typedoc-plugin-markdown", ...config.plugin ?? []]
      });
      if (!app.options.isSet("readme")) {
        app.options.setValue("readme", "none");
      }
      if (!app.options.isSet("logLevel")) {
        app.options.setValue("logLevel", "None");
      }
      const project = await app.convert();
      if (project) {
        await app.generateDocs(project, app.options.getValue("out"));
      } else {
        throw new Error("TypeDoc not initialised");
      }
    } catch (error) {
      const message = error.exitCode === 1 ? error.stdout + error.stderr : `\u26A0\uFE0F  ${projectTitle ? `${projectTitle} - ` : ""}Unable to generate docs`;
      (0, import_core11.log)(import_chalk5.default.yellow(message));
    }
  }
  (0, import_core11.createSuccessMessage)(projectTitle);
};
var getWriteMode = (mode) => {
  switch (mode) {
    case import_core11.OutputMode.SPLIT: {
      return import_core11.writeSplitMode;
    }
    case import_core11.OutputMode.TAGS: {
      return import_core11.writeTagsMode;
    }
    case import_core11.OutputMode.TAGS_SPLIT: {
      return import_core11.writeSplitTagsMode;
    }
    case import_core11.OutputMode.SINGLE:
    default: {
      return import_core11.writeSingleMode;
    }
  }
};

// src/generate.ts
var generateSpec = async (workspace, options, projectName) => {
  if (options.output.clean) {
    const extraPatterns = Array.isArray(options.output.clean) ? options.output.clean : [];
    if (options.output.target) {
      await (0, import_core12.removeFilesAndEmptyFolders)(
        ["**/*", "!**/*.d.ts", ...extraPatterns],
        (0, import_core12.getFileInfo)(options.output.target).dirname
      );
    }
    if (options.output.schemas) {
      await (0, import_core12.removeFilesAndEmptyFolders)(
        ["**/*", "!**/*.d.ts", ...extraPatterns],
        (0, import_core12.getFileInfo)(options.output.schemas).dirname
      );
    }
    (0, import_core12.log)(`${projectName ? `${projectName}: ` : ""}Cleaning output folder`);
  }
  const writeSpecBuilder = await importSpecs(workspace, options);
  await writeSpecs(writeSpecBuilder, workspace, options, projectName);
};
var generateSpecs = async (config, workspace, projectName) => {
  if (projectName) {
    const options = config[projectName];
    if (options) {
      try {
        await generateSpec(workspace, options, projectName);
      } catch (error) {
        (0, import_core12.logError)(error, projectName);
        process.exit(1);
      }
    } else {
      (0, import_core12.logError)("Project not found");
      process.exit(1);
    }
    return;
  }
  let hasErrors;
  const accumulate = await (0, import_core12.asyncReduce)(
    Object.entries(config),
    async (acc, [projectName2, options]) => {
      try {
        acc.push(await generateSpec(workspace, options, projectName2));
      } catch (error) {
        hasErrors = true;
        (0, import_core12.logError)(error, projectName2);
      }
      return acc;
    },
    []
  );
  if (hasErrors) process.exit(1);
  return accumulate;
};
var generateConfig = async (configFile, options) => {
  const {
    path,
    file: configExternal,
    error
  } = await (0, import_core12.loadFile)(configFile, {
    defaultFileName: "orval.config"
  });
  if (!configExternal) {
    throw `failed to load from ${path} => ${error}`;
  }
  const workspace = import_core12.upath.dirname(path);
  const config = await ((0, import_core12.isFunction)(configExternal) ? configExternal() : configExternal);
  const normalizedConfig = await (0, import_core12.asyncReduce)(
    Object.entries(config),
    async (acc, [key, value]) => {
      acc[key] = await normalizeOptions(value, workspace, options);
      return acc;
    },
    {}
  );
  const fileToWatch = Object.entries(normalizedConfig).filter(
    ([project]) => options?.projectName === void 0 || project === options?.projectName
  ).map(([, { input }]) => input.target).filter((target) => (0, import_core12.isString)(target));
  if (options?.watch && fileToWatch.length > 0) {
    startWatcher(
      options?.watch,
      () => generateSpecs(normalizedConfig, workspace, options?.projectName),
      fileToWatch
    );
  } else {
    await generateSpecs(normalizedConfig, workspace, options?.projectName);
  }
};

// src/index.ts
__reExport(index_exports, require("@orval/core"), module.exports);
var import_core14 = require("@orval/core");
var generate = async (optionsExport, workspace = process.cwd(), options) => {
  if (!optionsExport || (0, import_core13.isString)(optionsExport)) {
    return generateConfig(optionsExport, options);
  }
  const normalizedOptions = await normalizeOptions(
    optionsExport,
    workspace,
    options
  );
  if (options?.watch) {
    startWatcher(
      options?.watch,
      async () => {
        try {
          await generateSpec(workspace, normalizedOptions);
        } catch (error) {
          (0, import_core13.logError)(error, options?.projectName);
        }
      },
      normalizedOptions.input.target
    );
  } else {
    try {
      await generateSpec(workspace, normalizedOptions);
      return;
    } catch (error) {
      (0, import_core13.logError)(error, options?.projectName);
    }
  }
};
var index_default = generate;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Options,
  defineConfig,
  generate,
  ...require("@orval/core")
});
